import { prisma } from '../utils/prisma';
import { extractPagesFromPDF, extractCPFFromPDFPage } from '../utils/pdfUtils';
import { generateInitialPassword, cleanCPF } from '../utils/cpfUtils';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../utils/s3Utils';
import { kv } from '@vercel/kv';
import { ProcessingStatus } from '../types/types';

const CHUNK_SIZE = 5; // Número de páginas para processar por vez

export const processS3File = async (
  processId: string, 
  fileKey: string,
  year: number,
  month: number
) => {
  console.log(`Iniciando processamento do arquivo S3: ${fileKey}`);
  
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileKey
    });

    // Atualiza status para indicar início do download
    const downloadStatus: ProcessingStatus = {
      jobId: processId,
      status: 'processing',
      progress: 5,
      currentStep: 'Baixando arquivo do S3',
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    await kv.set(processId, downloadStatus);

    const response = await s3Client.send(command);
    if (!response.Body) {
      throw new Error('Corpo do arquivo vazio');
    }

    // Le o arquivo em chunks
    const chunks = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);
    
    console.log(`Arquivo baixado do S3, tamanho: ${fileBuffer.length} bytes`);

    // Atualiza status para indicar início da extração de páginas
    const extractionStatus: ProcessingStatus = {
      jobId: processId,
      status: 'processing',
      progress: 10,
      currentStep: 'Extraindo páginas do PDF',
      startedAt: downloadStatus.startedAt,
      lastUpdated: new Date().toISOString()
    };
    await kv.set(processId, extractionStatus);

    console.log('Extraindo páginas do PDF...');
    const pages = await extractPagesFromPDF(fileBuffer);
    const totalPages = pages.length;
    console.log(`Total de páginas extraídas: ${totalPages}`);

    const results = [];
    let processedPages = 0;
    const baseProgress = 10; // Progresso base após extração
    const progressPerPage = (90 / totalPages); // 90% restantes divididos pelo número de páginas

    // Processar em chunks para evitar timeout
    for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
      const chunk = pages.slice(i, i + CHUNK_SIZE);
      console.log(`Processando chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(pages.length/CHUNK_SIZE)}`);
      
      const chunkResults = await Promise.all(chunk.map(async (pageBuffer) => {
        try {
          console.log(`Extraindo CPF da página ${processedPages + 1}/${totalPages}`);
          const { cpf } = await extractCPFFromPDFPage(pageBuffer);
          const cleanedCPF = cleanCPF(cpf);
          console.log(`CPF extraído: ${cleanedCPF}`);

          let user = await prisma.user.findUnique({ where: { cpf: cleanedCPF } });
          if (!user) {
            console.log(`Criando novo usuário para CPF: ${cleanedCPF}`);
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
          console.log(`Contracheque criado: ${payslip.id}`);

          processedPages++;
          
          // Atualiza o progresso
          const currentProgress = Math.floor(baseProgress + (processedPages * progressPerPage));
          const processingStatus: ProcessingStatus = {
            jobId: processId,
            status: 'processing',
            progress: currentProgress,
            currentStep: `Processando página ${processedPages}/${totalPages}`,
            startedAt: downloadStatus.startedAt,
            lastUpdated: new Date().toISOString()
          };
          await kv.set(processId, processingStatus);

          console.log(`Progresso: ${currentProgress}% (${processedPages}/${totalPages} páginas)`);

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

      // Pequeno delay entre chunks para permitir outras operações
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Atualiza status final
    const completedStatus: ProcessingStatus = {
      jobId: processId,
      status: 'completed',
      progress: 100,
      currentStep: 'Processamento concluído',
      startedAt: downloadStatus.startedAt,
      lastUpdated: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      result: {
        totalPages,
        processedPages,
        success: processedPages > 0,
        results
      }
    };

    await kv.set(processId, completedStatus);
    console.log('Processamento concluído com sucesso');

    return completedStatus.result;

  } catch (error) {
    console.error('Erro ao processar arquivo:', error);

    // Atualiza status com erro
    const errorStatus: ProcessingStatus = {
      jobId: processId,
      status: 'error',
      progress: 0,
      currentStep: 'Erro no processamento',
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };

    await kv.set(processId, errorStatus);
    throw error;
  }
};