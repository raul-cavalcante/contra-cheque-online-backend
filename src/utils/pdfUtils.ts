import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';


export const extractPagesFromPDF = async (fileBuffer: Buffer) => {
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const pages: Buffer[] = [];
  const pageCount = pdfDoc.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);
    const newPdfBytes = await newPdf.save();
    pages.push(Buffer.from(newPdfBytes));
  }
  return pages;
};


export const extractCPFAndNameFromPDFPage = async (pageBuffer: Buffer) => {
  const data = await pdfParse(pageBuffer);
  const text = data.text;

  const cpfRegex = /(\d{3}\.\d{3}\.\d{3}-\d{2})/;
  const cpfMatch = text.match(cpfRegex);
  if (!cpfMatch) {
    throw new Error('CPF não encontrado na página');
  }
  const cpf = cpfMatch[0].replace(/\D/g, '');

  return { cpf};
};
