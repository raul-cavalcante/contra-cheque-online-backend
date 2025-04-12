import payrollQueue from './queues/payrollQueue';
import { extractPagesFromPDF } from './utils/pdfUtils';
import logger from './utils/logger';
import config from './config/config';

logger.info('Worker iniciado', {
  redisHost: config.redis.HOST,
  redisPort: config.redis.PORT
});

// Log quando um job for concluído com sucesso
payrollQueue.on('completed', async (job, result) => {
  logger.info(`Job ${job.id} concluído com sucesso`, {
    jobId: job.id,
    jobName: job.name,
    totalPages: result.totalPages
  });
});

// Log quando um job falhar
payrollQueue.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} falhou`, {
    jobId: job?.id,
    jobName: job?.name,
    error: err.message,
    stack: err.stack
  });
});

// Log para jobs ativos
payrollQueue.on('active', (job) => {
  logger.info(`Job ${job.id} iniciado`, {
    jobId: job.id,
    jobName: job.name,
    data: job.data
  });
});

// Processamento de jobs do tipo payrollQueue
payrollQueue.process(async (job) => {
  logger.info(`Processando job ${job.id}`, {
    jobId: job.id,
    jobData: {
      ...job.data,
      fileBuffer: job.data.fileBuffer ? 'Buffer presente' : 'Buffer ausente'
    }
  });

  try {
    const { fileBuffer } = job.data;
    
    if (!fileBuffer) {
      throw new Error('Buffer do arquivo não encontrado no job');
    }
    
    // Extrai páginas do PDF
    const pagesUrls = await extractPagesFromPDF(fileBuffer);
    logger.info(`Páginas extraídas com sucesso`, {
      jobId: job.id,
      totalPages: pagesUrls.length
    });
    
    // Retorna o resultado do processamento
    return { 
      totalPages: pagesUrls.length, 
      pagesUrls 
    };
  } catch (error: any) {
    logger.error(`Erro ao processar job ${job.id}`, {
      jobId: job.id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
});