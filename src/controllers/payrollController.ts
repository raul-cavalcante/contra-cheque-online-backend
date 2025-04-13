import { Request, Response } from 'express';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import fs from 'fs';
import path from 'path';
import payrollQueue from '../queues/payrollQueue';
import { v4 as uuidv4 } from 'uuid';

// Função para criar o diretório de uploads caso não exista
const ensureUploadDirExists = () => {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const absolutePath = path.resolve(uploadDir);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
  return absolutePath;
};

export const uploadPayroll = async (req: Request, res: Response): Promise<void> => {
  const parsed = uploadPayslipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const { year, month } = parsed.data;
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Arquivo é obrigatório' });
    return;
  }
  
  try {
    // Verificar tamanho do arquivo
    const fileSize = file.size;
    const maxSize = Number(process.env.MAX_FILE_SIZE || 4 * 1024 * 1024); // 4MB padrão para Vercel
    
    // Se o arquivo for muito grande, retornar um erro sugerindo o upload direto
    if (fileSize > maxSize) {
      res.status(413).json({
        error: 'Arquivo muito grande para upload direto',
        message: 'Use o endpoint /presigned-url para fazer upload de arquivos grandes diretamente para o S3',
        maxSize,
        actualSize: fileSize
      });
      return;
    }
    
    // Criar diretório para uploads temporários
    const uploadDir = ensureUploadDirExists();
    
    // Gerar nome único para o arquivo temporário
    const tempFileName = `payroll-${uuidv4()}.pdf`;
    const filePath = path.join(uploadDir, tempFileName);
    
    // Salvar o arquivo temporariamente no disco
    await fs.promises.writeFile(filePath, file.buffer);
    
    // Adicionar job à fila
    const job = await payrollQueue.add({
      filePath,
      year,
      month
    }, {
      attempts: 3, // Número de tentativas em caso de falha
      backoff: {
        type: 'exponential',
        delay: 5000 // Delay inicial de 5 segundos entre tentativas
      },
      removeOnComplete: true // Remove o job quando completado com sucesso
    });
    
    res.status(202).json({ 
      message: 'Processamento do contra-cheque iniciado com sucesso!', 
      jobId: job.id,
      status: 'processing'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Endpoint para verificar o status do job
export const checkJobStatus = async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;
  
  try {
    const job = await payrollQueue.getJob(jobId);
    
    if (!job) {
      res.status(404).json({ error: 'Job não encontrado' });
      return;
    }
    
    const state = await job.getState();
    const progress = await job.progress();
    
    let status = state;
    let result = null;
    
    if (state === 'completed') {
      result = job.returnvalue;
      status = 'completed';
    } else if (state === 'failed') {
      const failReason = job.failedReason;
      status = 'failed';
      result = { error: failReason };
    }
    
    res.json({
      jobId: job.id,
      status,
      progress,
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

