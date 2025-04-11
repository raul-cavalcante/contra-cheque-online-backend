import { prisma } from '../utils/prisma';
import { extractPagesFromPDF, extractCPFFromPDFPage } from '../utils/pdfUtils';
import { generateInitialPassword, cleanCPF } from '../utils/cpfUtils';
import { uploadToS3 } from '../utils/s3Utils';
import fs from 'fs';
import path from 'path';

export const processPayrollPDF = async (fileBuffer: Buffer, year: number, month: number) => {
  console.log(`Iniciando processamento do PDF para o ano ${year} e mês ${month}`);
  const pages = await extractPagesFromPDF(fileBuffer);
  const totalPages = pages.length;
  console.log(`Total de páginas extraídas: ${totalPages}`);

  for (let i = 0; i < totalPages; i++) {
    console.log(`Processando página ${i + 1} de ${totalPages}`);
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
  console.log(`Processamento concluído para ${totalPages} páginas.`);
  return totalPages;
};