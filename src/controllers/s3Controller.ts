import { Request, Response } from 'express';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import multer from 'multer';
import { s3Client, getPublicS3Url } from '../utils/s3Utils';
import { processS3File } from '../service/payrollService';
import { ProcessingStatus } from '../types/types';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } 
});

// Constantes para configuração
const MAX_PROCESSING_TIME = 5 * 60 * 1000; // 5 minutos
const STATUS_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hora
const MAX_ATTEMPTS = 3;

// Cache para armazenar o status do processamento
const processingStatus = new Map<string, ProcessingStatus>();

// Função para limpar status antigos
const cleanupOldStatus = () => {
  const now = Date.now();
  for (const [jobId, status] of processingStatus.entries()) {
    // Remove status completos ou com erro após 1 hora
    if (status.completedAt && now - new Date(status.completedAt).getTime() > STATUS_CLEANUP_INTERVAL) {
      processingStatus.delete(jobId);
      continue;
    }
    
    // Verifica timeout para processamentos ativos
    if (status.status === 'processing') {
      const startTime = new Date(status.startedAt).getTime();
      if (now - startTime > MAX_PROCESSING_TIME) {
        status.status = 'timeout';
        status.error = 'Tempo máximo de processamento excedido';
        status.completedAt = new Date().toISOString();
      }
    }
  }
};

// Executa limpeza a cada hora
setInterval(cleanupOldStatus, STATUS_CLEANUP_INTERVAL);

export const getPresignedUrl = async (req: Request, res: Response): Promise<void> => {
  console.log('Recebendo requisição para gerar URL pré-assinada:', req.body);
  
  try {
    const parsed = uploadPayslipSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Erro na validação dos dados:', parsed.error.format());
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { year, month } = parsed.data;
    console.log(`Dados validados com sucesso: year=${year}, month=${month}`);

    const contentType = req.body.contentType || 'application/pdf';
    const fileKey = `uploads/${year}-${month}.pdf`;
    
    console.log(`Gerando URL pré-assinada para o arquivo: ${fileKey}`);

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      ACL: 'public-read'
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300
    });

    console.log('URL pré-assinada gerada com sucesso');

    res.json({
      uploadUrl: signedUrl,
      fileKey,
      year,
      month,
      expiresIn: 300,
      contentType
    });
  } catch (error: any) {
    console.error('Erro ao gerar URL pré-assinada:', error);
    res.status(500).json({ error: error.message });
  }
};

export const processS3Upload = async (req: Request, res: Response): Promise<void> => {
  console.log('Iniciando processamento de upload no S3:', {
    body: req.body
  });
  
  try {
    const { fileKey, year, month } = req.body;

    if (!fileKey) {
      res.status(400).json({ error: 'fileKey é obrigatório' });
      return;
    }

    const jobId = `${year}-${month}-${Date.now()}`;
    
    // Configura status inicial
    const status: ProcessingStatus = {
      status: 'processing',
      progress: 0,
      startedAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      timeoutAt: new Date(Date.now() + MAX_PROCESSING_TIME).toISOString()
    };
    
    processingStatus.set(jobId, status);

    // Retorna imediatamente com status 202
    res.status(202).json({
      message: 'Processamento iniciado',
      jobId,
      status: status.status,
      timeoutAt: status.timeoutAt,
      fileUrl: getPublicS3Url(fileKey)
    });

    // Processa em background
    processS3File(fileKey, year, month)
      .then(result => {
        console.log('Processamento concluído com sucesso:', result);
        status.status = 'completed';
        status.result = result;
        status.completedAt = new Date().toISOString();
        status.progress = 100;
      })
      .catch(error => {
        console.error('Erro no processamento:', error);
        status.attempts = (status.attempts || 0) + 1;
        
        if (status.attempts >= MAX_ATTEMPTS) {
          status.status = 'error';
          status.error = error.message;
          status.completedAt = new Date().toISOString();
        } else {
          // Tenta novamente se não atingiu o número máximo de tentativas
          processS3Upload(req, res);
        }
      });

  } catch (error: any) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

export const checkProcessingStatus = async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;
  
  if (!jobId) {
    res.status(400).json({ error: 'jobId é obrigatório' });
    return;
  }

  const status = processingStatus.get(jobId);
  
  if (!status) {
    res.status(404).json({ error: 'Job não encontrado' });
    return;
  }

  // Verifica se o processamento excedeu o tempo limite
  if (status.status === 'processing' && status.timeoutAt) {
    const now = new Date();
    const timeoutAt = new Date(status.timeoutAt);
    
    if (now > timeoutAt) {
      status.status = 'timeout';
      status.error = 'Tempo máximo de processamento excedido';
      status.completedAt = now.toISOString();
    }
  }

  // Adiciona headers para controle de cache no cliente
  if (status.status === 'processing') {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Next-Check', '3'); // Sugere próxima verificação em 3 segundos
  } else {
    res.setHeader('Cache-Control', 'private, max-age=3600');
  }

  res.json(status);
};

export const getPresignedDownloadUrl = async (req: Request, res: Response): Promise<void> => {
  console.log('Recebendo requisição para gerar URL pré-assinada de download:', req.body);
  try {
    const { fileKey } = req.body;

    if (!fileKey) {
      console.error('Erro: fileKey não fornecido na requisição');
      res.status(400).json({ error: 'fileKey é obrigatório' });
      return;
    }

    console.log(`Gerando URL pré-assinada de download para o arquivo: ${fileKey}`);

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileKey
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    console.log('URL pré-assinada de download gerada com sucesso:', presignedUrl);

    res.json({
      downloadUrl: presignedUrl,
      fileKey,
      expiresIn: 300
    });
  } catch (error: any) {
    console.error('Erro ao gerar URL pré-assinada de download:', error);
    res.status(500).json({ error: error.message });
  }
};