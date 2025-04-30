import { prisma } from '../utils/prisma';
import { extractPagesFromPDF, extractCPFFromPDFPage } from '../utils/pdfUtils';
import { generateInitialPassword, cleanCPF } from '../utils/cpfUtils';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, getPublicS3Url } from '../utils/s3Utils';

const CHUNK_SIZE = 5; // Número de páginas para processar por vez

export const processS3File = async (
  fileKey: string,
  year: number,
  month: number,
) => {
  console.log(`Iniciando processamento do arquivo S3: ${fileKey}`);
  
  try {
    // Buscar o arquivo do S3
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileKey
    });

    const response = await s3Client.send(command);
    if (!response.Body) {
      throw new Error('Corpo do arquivo vazio');
    }

    // Converter o ReadableStream para Buffer
    const chunks = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);
    
    console.log(`Arquivo baixado do S3, tamanho: ${fileBuffer.length} bytes`);

    // Extrair páginas do PDF
    const pages = await extractPagesFromPDF(fileBuffer);
    const totalPages = pages.length;
    console.log(`Total de páginas extraídas: ${totalPages}`);

    const results = [];
    let processedPages = 0;
    const fileUrl = getPublicS3Url(fileKey);

    // Processar em chunks para evitar timeout
    for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
      const chunk = pages.slice(i, i + CHUNK_SIZE);
      
      const chunkResults = await Promise.all(chunk.map(async (pageBuffer) => {
        try {
          const { cpf } = await extractCPFFromPDFPage(pageBuffer);
          const cleanedCPF = cleanCPF(cpf);

          let user = await prisma.user.findUnique({ where: { cpf: cleanedCPF } });
          if (!user) {
            user = await prisma.user.create({
              data: {
                cpf: cleanedCPF,
                password: generateInitialPassword(cleanedCPF),
              },
            });
          }

          const payslip = await prisma.payslip.create({
            data: {
              userId: user.id,
              year,
              month,
              fileUrl,
              cpf: cleanedCPF,
            },
          });

          processedPages++;
          console.log(`Progresso: ${processedPages}/${totalPages} páginas processadas`);

          return {
            cpf: cleanedCPF,
            payslipId: payslip.id,
            success: true
          };
        } catch (error) {
          console.error(`Erro ao processar página: ${error}`);
          return {
            error: `Erro ao processar página: ${error}`,
            success: false
          };
        }
      }));

      results.push(...chunkResults);
    }

    return {
      totalPages,
      processedPages,
      results,
      success: processedPages > 0,
      fileUrl
    };
  } catch (error) {
    console.error('Erro ao processar arquivo:', error);
    throw error;
  }
};