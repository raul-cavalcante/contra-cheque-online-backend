import payrollQueue from './queues/payrollQueue';
import { extractPagesFromPDF } from './utils/pdfUtils';

console.log('Worker iniciado. Aguardando jobs na fila "payrollQueue"...');

payrollQueue.on('completed', async (job, result) => {
  console.log(`Job ${job.id} concluído. Total de páginas processadas: ${result.totalPages}`);
});

payrollQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} falhou: ${err.message}`);
});

// Exemplo de processamento de um job
payrollQueue.process(async (job) => {
  const { fileBuffer } = job.data; // Supondo que o buffer do arquivo PDF seja enviado no job
  const pagesUrls = await extractPagesFromPDF(fileBuffer); // URLs das páginas no S3
  return { totalPages: pagesUrls.length, pagesUrls }; // Retorna as URLs das páginas
});