import Queue from 'bull';
import { processPayrollPDF } from '../service/payrollService';
import fs from 'fs';

const payrollQueue = new Queue('payrollQueue', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379
  }
});

payrollQueue.process(async (job) => {
  const { filePath, year, month } = job.data;
  // Lê o arquivo do disco e processa o PDF
  const fileBuffer = await fs.promises.readFile(filePath);
  const totalPages = await processPayrollPDF(fileBuffer, year, month);
  // Remove o arquivo temporário
  await fs.promises.unlink(filePath);
  return { totalPages };
});

export default payrollQueue;
