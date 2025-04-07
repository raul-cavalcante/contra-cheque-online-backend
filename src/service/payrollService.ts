import { prisma } from '../utils/prisma';
import { extractPagesFromPDF, extractCPFFromPDFPage } from '../utils/pdfUtils';
import { generateInitialPassword, cleanCPF } from '../utils/cpfUtils';
import { uploadToS3 } from '../utils/s3Utils';
import fs from 'fs';
import path from 'path';

export const processPayrollPDF = async (fileBuffer: Buffer, year: number, month: number) => {
  const pages = await extractPagesFromPDF(fileBuffer);
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i++) {
    const pageBuffer = pages[i];
    const { cpf } = await extractCPFFromPDFPage(pageBuffer);

    // Limpa o CPF para garantir que está no formato correto
    const cleanedCPF = cleanCPF(cpf);

    let user = await prisma.user.findUnique({ where: { cpf: cleanedCPF } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          cpf: cleanedCPF, // Armazena o CPF limpo no banco de dados
          password: generateInitialPassword(cleanedCPF),
        },
      });
    }

    // Gera um nome de arquivo único para o PDF individual.
    const fileName = `${year}-${month}-${cleanedCPF}.pdf`;

    // Faz upload do arquivo para o S3.
    const fileUrl = await uploadToS3(pageBuffer, fileName, 'application/pdf');

    // Registra o contra-cheque no banco de dados.
    await prisma.payslip.create({
      data: {
        userId: user.id,
        year,
        month,
        fileUrl, // Salva a URL do S3 no banco
        cpf: cleanedCPF,
      },
    });
  }
  return totalPages;
};