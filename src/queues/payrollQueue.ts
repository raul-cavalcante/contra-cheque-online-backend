import Queue from 'bull';
import { processPayrollPDF, processS3File } from '../service/payrollService';
import fs from 'fs';
import path from 'path';

// Definir concorrência (número de jobs processados simultaneamente)
const CONCURRENCY = Number(process.env.QUEUE_CONCURRENCY) || 2;

const payrollQueue = new Queue('payrollQueue', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD // Adiciona suporte a senha para produção
  },
  defaultJobOptions: {
    attempts: 3, // Número padrão de tentativas
    backoff: {
      type: 'exponential',
      delay: 5000 // 5 segundos
    },
    removeOnComplete: true, // Remove jobs completos para economizar memória
    removeOnFail: 5, // Mantém no máximo 5 jobs falhos para debug
  }
});

// Processar arquivos do disco (upload tradicional)
payrollQueue.process(CONCURRENCY, async (job, done) => {
  try {
    // Verificar o tipo de job para determinar o processamento
    if (job.name === 'processS3File') {
      // Processamento de arquivo do S3
      const { fileKey, year, month } = job.data;
      
      // Reportar progresso - 10%
      await job.progress(10);
      
      // Processar o arquivo do S3
      const totalPages = await processS3File(
        fileKey,
        year,
        month,
        async (percentComplete) => {
          // Mapear o progresso de 10% a 100%
          const mappedProgress = 10 + (percentComplete * 0.9);
          await job.progress(Math.floor(mappedProgress));
        }
      );
      
      // Concluir o job com sucesso
      return { totalPages, year, month, source: 'S3' };
    }
    
    // Processamento tradicional (arquivo do disco)
    const { filePath, year, month } = job.data;
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
    
    // Reportar progresso - 10%
    await job.progress(10);
    
    // Ler o arquivo do disco
    const fileBuffer = await fs.promises.readFile(filePath);
    
    // Reportar progresso - 30%
    await job.progress(30);
    
    // Processar o PDF
    const totalPages = await processPayrollPDF(
      fileBuffer, 
      year, 
      month,
      async (percentComplete) => {
        // Mapear o progresso de 30% a 90% durante o processamento
        const mappedProgress = 30 + (percentComplete * 0.6);
        await job.progress(Math.floor(mappedProgress));
      }
    );
    
    // Reportar progresso - 90%
    await job.progress(90);
    
    // Remover o arquivo temporário
    await fs.promises.unlink(filePath);
    
    // Progresso completo
    await job.progress(100);
    
    // Concluir o job com sucesso
    return { totalPages, year, month, source: 'upload' };
  } catch (error) {
    console.error('Erro no processamento da fila:', error);
    throw error; // Propagar o erro para que Bull possa gerenciar as tentativas
  }
});

export default payrollQueue;
