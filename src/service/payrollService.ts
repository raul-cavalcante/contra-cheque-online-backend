import { prisma } from '../utils/prisma';
import { extractPagesFromPDF, extractCPFFromPDFPage } from '../utils/pdfUtils';
import { generateInitialPassword, cleanCPF } from '../utils/cpfUtils';
import { uploadToS3 } from '../utils/s3Utils';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import config from '../config/config';

export const processPayrollPDF = async (fileBuffer: Buffer, year: number, month: number) => {
  if (!fileBuffer || fileBuffer.length === 0) {
    const error = new Error('Buffer do PDF inválido ou vazio');
    logger.error('Erro no processamento do PDF', { error: error.message });
    throw error;
  }

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    const error = new Error(`Período inválido: ano=${year}, mês=${month}`);
    logger.error('Erro no processamento do PDF', { error: error.message, year, month });
    throw error;
  }

  logger.info(`Iniciando processamento do PDF para o ano ${year} e mês ${month}`, {
    fileSize: fileBuffer.length,
    year,
    month
  });

  try {
    // Extrai as páginas do PDF
    const pages = await extractPagesFromPDF(fileBuffer);
    const totalPages = pages.length;
    
    logger.info(`Total de páginas extraídas: ${totalPages}`, { year, month });

    if (totalPages === 0) {
      throw new Error('Nenhuma página encontrada no PDF');
    }

    // Registra os detalhes de cada página processada
    const processedPages = [];

    for (let i = 0; i < totalPages; i++) {
      logger.info(`Processando página ${i + 1} de ${totalPages}`, { year, month });
      
      try {
        const pageBuffer = pages[i];
        if (!pageBuffer || pageBuffer.length === 0) {
          logger.warn(`Página ${i + 1} vazia, pulando...`, { year, month });
          continue;
        }

        // Extrai o CPF da página
        const extractResult = await extractCPFFromPDFPage(pageBuffer);
        if (!extractResult || !extractResult.cpf) {
          logger.warn(`Não foi possível extrair CPF da página ${i + 1}, pulando...`, { year, month });
          continue;
        }

        const { cpf } = extractResult;
        logger.info(`CPF extraído da página ${i + 1}: ${cpf}`, { year, month });

        // Limpa o CPF para garantir formato correto
        const cleanedCPF = cleanCPF(cpf);
        if (!cleanedCPF) {
          logger.warn(`CPF inválido após limpeza: ${cpf}, pulando página ${i + 1}...`, { year, month });
          continue;
        }

        logger.info(`CPF limpo: ${cleanedCPF}`, { year, month, page: i + 1 });

        // Busca ou cria o usuário
        let user = await prisma.user.findUnique({ where: { cpf: cleanedCPF } });
        
        if (!user) {
          const initialPassword = generateInitialPassword(cleanedCPF);
          logger.info(`Criando novo usuário para CPF: ${cleanedCPF}`, { year, month, page: i + 1 });
          
          user = await prisma.user.create({
            data: {
              cpf: cleanedCPF,
              password: initialPassword,
            },
          });
          
          logger.info(`Usuário criado com sucesso: ${user.id}`, { cpf: cleanedCPF });
        } else {
          logger.info(`Usuário existente encontrado: ${user.id}`, { cpf: cleanedCPF });
        }

        // Gera um nome de arquivo único para o PDF individual
        const fileName = `${year}/${month}/${cleanedCPF}.pdf`;
        logger.info(`Nome do arquivo gerado: ${fileName}`, { userId: user.id });

        // Upload para o S3
        logger.info(`Iniciando upload para S3: ${fileName}`, { userId: user.id, size: pageBuffer.length });
        const fileUrl = await uploadToS3(pageBuffer, fileName, 'application/pdf');
        logger.info(`Arquivo enviado para o S3: ${fileUrl}`, { userId: user.id });

        // Verifica se já existe um contracheque para esse usuário/mês/ano
        const existingPayslip = await prisma.payslip.findFirst({
          where: {
            userId: user.id,
            year,
            month,
          }
        });

        if (existingPayslip) {
          logger.info(`Atualizando contracheque existente para ${user.id}`, { 
            payslipId: existingPayslip.id, 
            year, 
            month 
          });
          
          await prisma.payslip.update({
            where: { id: existingPayslip.id },
            data: { fileUrl }
          });
          
          processedPages.push({ userId: user.id, payslipId: existingPayslip.id, updated: true });
        } else {
          // Registra o contra-cheque no banco de dados
          logger.info(`Registrando novo contracheque para usuário ${user.id}`, { year, month });
          
          const payslip = await prisma.payslip.create({
            data: {
              userId: user.id,
              year,
              month,
              fileUrl,
              cpf: cleanedCPF,
            },
          });
          
          logger.info(`Contracheque registrado com sucesso`, { 
            payslipId: payslip.id, 
            userId: user.id, 
            year, 
            month 
          });
          
          processedPages.push({ userId: user.id, payslipId: payslip.id, new: true });
        }
      } catch (error: any) {
        logger.error(`Erro ao processar a página ${i + 1}`, {
          error: error.message,
          stack: error.stack,
          year,
          month
        });
        // Continua processando outras páginas mesmo se uma falhar
      }
    }

    logger.info(`Processamento concluído para ${totalPages} páginas`, {
      year,
      month,
      processedSuccessfully: processedPages.length,
      skipped: totalPages - processedPages.length
    });
    
    return totalPages;
  } catch (error: any) {
    logger.error(`Erro crítico ao processar o PDF`, {
      error: error.message,
      stack: error.stack,
      year,
      month
    });
    throw error;
  }
};