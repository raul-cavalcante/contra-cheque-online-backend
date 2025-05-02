import { prisma } from '../utils/prisma';
import { extractPagesFromPDF, extractCPFFromPDFPage } from '../utils/pdfUtils';
import { generateInitialPassword, cleanCPF } from '../utils/cpfUtils';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../utils/s3Utils';

const CHUNK_SIZE = 5; // Número de páginas para processar por vez

export const processS3File = async (
  fileKey: string,
  year: number,
  month: number,
) => {
  console.log(`Iniciando processamento do arquivo S3: ${fileKey}`);
  
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileKey
    });

    const response = await s3Client.send(command);
    if (!response.Body) {
      throw new Error('Corpo do arquivo vazio');
    }

    const chunks = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);
    
    console.log(`Arquivo baixado do S3, tamanho: ${fileBuffer.length} bytes`);

    const pages = await extractPagesFromPDF(fileBuffer);
    const totalPages = pages.length;
    console.log(`Total de páginas extraídas: ${totalPages}`);

    const results = [];
    let processedPages = 0;

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
              fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
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
      success: processedPages > 0
    };
  } catch (error) {
    console.error('Erro ao processar arquivo:', error);
    throw error;
  }
};