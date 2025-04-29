import Queue from 'bull';
import { processPayrollPDF, processS3File } from '../service/payrollService';

// Definir concorrência (número de jobs processados simultaneamente)
const CONCURRENCY = Number(process.env.QUEUE_CONCURRENCY) || 2;

const queueConfig = {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.NODE_ENV === 'production' ? {} : undefined,
    maxRetriesPerRequest: 3
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: 5,
    timeout: 300000 // 5 minutos
  },
  settings: {
    lockDuration: 300000, // 5 minutos
    stalledInterval: 30000, // 30 segundos
    maxStalledCount: 2
  }
};

const payrollQueue = new Queue('payrollQueue', queueConfig);

// Tratamento de erros da fila
payrollQueue.on('error', (error) => {
  console.error('Erro na fila:', error);
});

payrollQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} falhou:`, error);
});

payrollQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`);
});

// Processar arquivos do S3
payrollQueue.process(CONCURRENCY, async (job) => {
  console.log(`Iniciando processamento do job ${job.id}:`, job.data);
  
  try {
    const { fileKey, year, month } = job.data;
    
    // Reportar progresso inicial
    await job.progress(10);
    
    if (job.name === 'processS3File') {
      // Processar arquivo do S3
      const totalPages = await processS3File(
        fileKey,
        year,
        month,
        async (percentComplete) => {
          const mappedProgress = 10 + (percentComplete * 0.9);
          await job.progress(Math.floor(mappedProgress));
        }
      );
      
      return { totalPages, year, month, source: 'S3' };
    }
    
    throw new Error('Tipo de job não suportado');
  } catch (error) {
    console.error(`Erro no processamento do job ${job.id}:`, error);
    throw error;
  }
});

export default payrollQueue;
