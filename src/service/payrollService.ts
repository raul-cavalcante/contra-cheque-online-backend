// src/services/payrollService.ts
import {prisma} from '../utils/prisma';
import { extractPagesFromPDF, extractCPFAndNameFromPDFPage } from '../utils/pdfUtils';
import { generateInitialPassword } from '../utils/cpfUtils';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

export const processPayrollPDF = async (fileBuffer: Buffer, year: number, month: number) => {
  const pages = await extractPagesFromPDF(fileBuffer);
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i++) {
    const pageBuffer = pages[i];
    const { cpf } = await extractCPFAndNameFromPDFPage(pageBuffer);

    let user = await prisma.user.findUnique({ where: { cpf } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          cpf,
          password: generateInitialPassword(cpf)
        }
      });
    }

    // Gera um nome de arquivo único para o PDF individual.
    const fileName = `${year}-${month}-${cpf}.pdf`;
    const filePath = `uploads/${fileName}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, fileName), pageBuffer);

    // Registra o contra-cheque no banco de dados.
    await prisma.payslip.create({
      data: {
        userId: user.id,
        year,
        month,
        fileUrl: filePath,
        cpf
      }
    });
  }
  return totalPages;
};
