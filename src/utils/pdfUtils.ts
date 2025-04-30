import { PDFDocument } from 'pdf-lib';
import PDFParse from 'pdf-parse';
import { uploadToS3 } from './s3Utils'; // Importa a função de upload para o S3

export const extractPagesFromPDF = async (fileBuffer: Buffer) => {
  console.log('Extraindo páginas do PDF');
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const pages: Buffer[] = []; // Alterado para armazenar buffers das páginas
  const pageCount = pdfDoc.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);
    const newPdfBytes = await newPdf.save();
    pages.push(Buffer.from(newPdfBytes)); // Adiciona o buffer da página à lista
  }
  return pages; // Retorna os buffers das páginas
};

export const extractCPFFromPDFPage = async (pageBuffer: Buffer) => {
  console.log('Extraindo CPF da página do PDF');
  const pdfData = await PDFParse(pageBuffer);
  const text = pdfData.text;

  // Regex para extrair o CPF (formato: 000.000.000-00)
  const cpfMatch = text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  const cpf = cpfMatch ? cpfMatch[0] : null;

  if (!cpf) {
    throw new Error('Não foi possível extrair o CPF da página.');
  }

  return { cpf };
};