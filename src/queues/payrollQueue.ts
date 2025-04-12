import Queue from 'bull';
import { processPayrollPDF } from '../service/payrollService';
import fs from 'fs';
import logger from '../utils/logger';
import config from '../config/config';

// Cria uma fila com configurações do Redis
const payrollQueue = new Queue('payrollQueue', {
  redis: {
    host: config.redis.HOST,
    port: config.redis.PORT,
    password: config.redis.PASSWORD,
  },
  limiter: {
    max: 5, // Limita a 5 jobs por
    duration: 5000, // 5 segundos
  },
  defaultJobOptions: {
    attempts: 3, // Tenta até 3 vezes em caso de falha
    backoff: {
      type: 'exponential',
      delay: 5000, // Espera 5 segundos antes da primeira tentativa
    },
    removeOnComplete: true, // Remove o job após ser concluído
    removeOnFail: false, // Mantém jobs que falharam para análise
  }
});

logger.info('Fila payrollQueue configurada', {
  redisHost: config.redis.HOST,
  redisPort: config.redis.PORT
});

payrollQueue.process(async (job) => {
  logger.info(`Processando job de contra-cheque`, {
    jobId: job.id,
    year: job.data.year,
    month: job.data.month
  });

  try {
    const { filePath, year, month } = job.data;
    
    if (!filePath) {
      throw new Error('Caminho do arquivo não fornecido no job');
    }
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    // Lê o arquivo do disco
    const fileBuffer = await fs.promises.readFile(filePath);
    logger.info(`Arquivo lido com sucesso: ${filePath}`, { size: fileBuffer.length });
    
    // Processa o PDF
    const totalPages = await processPayrollPDF(fileBuffer, year, month);
    
    // Remove o arquivo temporário
    await fs.promises.unlink(filePath);
    logger.info(`Arquivo temporário removido: ${filePath}`);
    
    return { totalPages, success: true };
  } catch (error: any) {
    logger.error(`Erro ao processar job de contra-cheque`, {
      jobId: job.id,
      error: error.message,
      stack: error.stack
    });
    throw error; // Re-lança o erro para que o Bull possa gerenciar as tentativas
  }
});

export default payrollQueue;
