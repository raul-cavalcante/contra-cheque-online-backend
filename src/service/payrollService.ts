import { prisma } from '../utils/prisma';
import { extractPagesFromPDF, extractCPFFromPDFPage } from '../utils/pdfUtils';
import { generateInitialPassword, cleanCPF } from '../utils/cpfUtils';
import { uploadToS3 } from '../utils/s3Utils';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';

// Configuração do cliente S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Tipo para o callback de progresso
type ProgressCallback = (percentComplete: number) => Promise<void> | void;

/**
 * Processa um arquivo do S3
 */
export const processS3File = async (
  fileKey: string,
  year: number,
  month: number,
  progressCallback?: ProgressCallback
) => {
  console.log(`Iniciando processamento do arquivo S3 (${fileKey}) para o ano ${year} e mês ${month}`);
  
  // Reportar início do progresso
  if (progressCallback) {
    await progressCallback(5);
  }
  
  try {
    // Buscar o arquivo do S3
    const s3Params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileKey
    };
    
    console.log(`Buscando arquivo do S3: ${fileKey}`);
    const s3Response = await s3.getObject(s3Params).promise();
    
    // Reportar progresso após download do S3
    if (progressCallback) {
      await progressCallback(15);
    }
    
    // Converter para Buffer
    const fileBuffer = s3Response.Body as Buffer;
    console.log(`Arquivo baixado do S3, tamanho: ${fileBuffer.length} bytes`);
    
    // Processar o PDF usando a função existente
    const totalPages = await processPayrollPDF(fileBuffer, year, month, progressCallback);
    
    // Opcionalmente remover o arquivo original após processamento
    try {
      await s3.deleteObject(s3Params).promise();
      console.log(`Arquivo original removido do S3: ${fileKey}`);
    } catch (deleteErr) {
      console.warn(`Não foi possível remover o arquivo original do S3: ${fileKey}`, deleteErr);
    }
    
    return totalPages;
  } catch (error) {
    console.error(`Erro ao processar arquivo do S3:`, error);
    throw error;
  }
};

export const processPayrollPDF = async (
  fileBuffer: Buffer, 
  year: number, 
  month: number,
  progressCallback?: ProgressCallback
) => {
  console.log(`Iniciando processamento do PDF para o ano ${year} e mês ${month}`);
  
  // Extrair páginas do PDF
  const pages = await extractPagesFromPDF(fileBuffer);
  const totalPages = pages.length;
  console.log(`Total de páginas extraídas: ${totalPages}`);
  
  // Reportar progresso após extração de páginas
  if (progressCallback) {
    await progressCallback(10); // 10% após extração inicial
  }

  // Processar cada página
  for (let i = 0; i < totalPages; i++) {
    console.log(`Processando página ${i + 1} de ${totalPages}`);
    
    // Calcular e reportar progresso atual
    if (progressCallback) {
      const percentComplete = Math.floor((i / totalPages) * 100);
      await progressCallback(percentComplete);
    }
    
    const pageBuffer = pages[i];
    try {
      const { cpf } = await extractCPFFromPDFPage(pageBuffer);
      console.log(`CPF extraído: ${cpf}`);

      const cleanedCPF = cleanCPF(cpf);
      console.log(`CPF limpo: ${cleanedCPF}`);

      let user = await prisma.user.findUnique({ where: { cpf: cleanedCPF } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            cpf: cleanedCPF,
            password: generateInitialPassword(cleanedCPF),
          },
        });
        console.log(`Usuário criado: ${user.id}`);
      }

      const fileName = `${year}-${month}-${cleanedCPF}.pdf`;
      console.log(`Nome do arquivo gerado: ${fileName}`);

      const fileUrl = await uploadToS3(pageBuffer, fileName, 'application/pdf');
      console.log(`Arquivo enviado para o S3: ${fileUrl}`);

      await prisma.payslip.create({
        data: {
          userId: user.id,
          year,
          month,
          fileUrl,
          cpf: cleanedCPF,
        },
      });
      console.log(`Contra-cheque registrado no banco de dados para o usuário ${user.id}`);
    } catch (error) {
      console.error(`Erro ao processar a página ${i + 1}:`, error);
      throw error;
    }
  }
  
  // Reportar 100% ao finalizar
  if (progressCallback) {
    await progressCallback(100);
  }
  
  console.log(`Processamento concluído para ${totalPages} páginas.`);
  return totalPages;
};