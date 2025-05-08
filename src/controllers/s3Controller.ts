import { Request, Response } from 'express';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import multer from 'multer';
import { s3Client, getPublicS3Url } from '../utils/s3Utils';
import { processS3File } from '../service/payrollService';
import { kv } from '@vercel/kv';
import { ProcessingStatus } from '../types/types';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } 
});

// Configurações
const MAX_PROCESSING_TIME = 5 * 60; // 5 minutos em segundos
const RETRY_DELAY = 3; // 3 segundos
const MAX_RETRIES = 3;

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
  console.log('Iniciando processamento de upload no S3:', req.body);
  
  try {
    const { fileKey, year, month } = req.body;

    if (!fileKey) {
      res.status(400).json({ error: 'fileKey é obrigatório' });
      return;
    }

    const jobId = `process:${year}-${month}-${Date.now()}`;
    const now = new Date();
    
    // Inicia o status do processamento no KV
    const initialStatus: ProcessingStatus = {
      status: 'processing',
      startedAt: now.toISOString(),
      progress: 0,
      attempts: 0,
      maxAttempts: MAX_RETRIES,
      timeoutAt: new Date(now.getTime() + MAX_PROCESSING_TIME * 1000).toISOString()
    };

    await kv.set(jobId, initialStatus, { ex: MAX_PROCESSING_TIME });

    // Retorna imediatamente com o jobId
    res.status(202).json({
      message: 'Processamento iniciado',
      jobId,
      status: 'processing',
      retryAfter: RETRY_DELAY,
      fileUrl: getPublicS3Url(fileKey)
    });

    // Processa em background
    processS3File(fileKey, year, month)
      .then(async result => {
        await kv.set(jobId, {
          ...initialStatus,
          status: 'completed',
          progress: 100,
          result,
          completedAt: new Date().toISOString()
        }, { ex: 3600 }); // Guarda por 1h após completar
      })
      .catch(async error => {
        console.error('Erro no processamento:', error);
        const status = await kv.get<ProcessingStatus>(jobId);
        
        if (status) {
          const attempts = (status.attempts || 0) + 1;
          if (attempts < MAX_RETRIES) {
            await kv.set(jobId, {
              ...status,
              attempts,
              lastUpdated: new Date().toISOString()
            });
            // Tenta novamente
            processS3Upload(req, res);
          } else {
            await kv.set(jobId, {
              ...status,
              status: 'error',
              error: error.message,
              completedAt: new Date().toISOString()
            }, { ex: 3600 });
          }
        }
      });

  } catch (error: any) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

export const checkProcessingStatus = async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;
  const ifNoneMatch = req.headers['if-none-match'];
  const ifModifiedSince = req.headers['if-modified-since'];
  
  if (!jobId) {
    res.status(400).json({ error: 'jobId é obrigatório' });
    return;
  }

  const status = await kv.get<ProcessingStatus>(jobId);
  
  if (!status) {
    res.status(404).json({ 
      error: 'Job não encontrado',
      details: 'O status pode ter expirado ou o jobId está incorreto'
    });
    return;
  }

  // Verifica timeout
  const now = new Date();
  const timeoutAt = status.timeoutAt ? new Date(status.timeoutAt) : null;
  
  if (timeoutAt && now > timeoutAt && status.status === 'processing') {
    const updatedStatus = {
      ...status,
      status: 'error' as const,
      error: 'Tempo máximo de processamento excedido',
      completedAt: now.toISOString()
    };
    
    await kv.set(jobId, updatedStatus, { ex: 3600 });
    status.status = 'error';
    status.error = updatedStatus.error;
    status.completedAt = updatedStatus.completedAt;
  }

  // Gera ETag baseado no estado atual
  const statusJson = JSON.stringify(status);
  const currentEtag = `"${Buffer.from(statusJson).toString('base64')}"`;
  const lastModified = status.lastUpdated || status.startedAt;

  // Verifica se o conteúdo foi modificado
  if (ifNoneMatch === currentEtag || 
      (ifModifiedSince && new Date(ifModifiedSince) >= new Date(lastModified))) {
    res.status(304).end();
    return;
  }

  // Define headers
  res.setHeader('ETag', currentEtag);
  res.setHeader('Last-Modified', lastModified);
  res.setHeader('Cache-Control', status.status === 'processing' ? 'no-cache' : 'private, max-age=3600');
  
  if (status.status === 'processing') {
    res.setHeader('Retry-After', RETRY_DELAY.toString());
  }

  res.json({
    ...status,
    maxTime: MAX_PROCESSING_TIME,
    retryDelay: RETRY_DELAY,
    maxRetries: MAX_RETRIES
  });
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