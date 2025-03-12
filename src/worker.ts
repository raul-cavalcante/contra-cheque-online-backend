// src/worker.ts
import payrollQueue from './queues/payrollQueue';

console.log('Worker iniciado. Aguardando jobs na fila "payrollQueue"...');

// Opcional: log dos eventos do job
payrollQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} concluído. Total de páginas processadas: ${result.totalPages}`);
});

payrollQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} falhou: ${err.message}`);
});
