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
      jobId,
      status: 'processing',
      startedAt: now.toISOString(),
      progress: 0,
      currentStep: 'Iniciando processamento',
      attempts: 0,
      maxAttempts: MAX_RETRIES,
      timeoutAt: new Date(now.getTime() + MAX_PROCESSING_TIME * 1000).toISOString(),
      lastUpdated: now.toISOString()
    };

    await kv.set(jobId, initialStatus, { ex: MAX_PROCESSING_TIME });

    // Retorna imediatamente com o jobId
    res.status(202).json({
      message: 'Processamento iniciado',
      jobId,
      status: initialStatus.status,
      progress: initialStatus.progress,
      currentStep: initialStatus.currentStep,
      retryDelay: RETRY_DELAY,
      maxTime: MAX_PROCESSING_TIME,
      fileUrl: getPublicS3Url(fileKey)
    });

    // Processa em background
    processS3File(jobId, fileKey, year, month)
      .then(async result => {
        await kv.set(jobId, {
          ...initialStatus,
          status: 'completed',
          progress: 100,
          currentStep: 'Processamento concluído',
          result,
          completedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }, { ex: 3600 }); // Guarda por 1h após completar
      })
      .catch(async error => {
        console.error('Erro no processamento:', error);
        const status = await kv.get<ProcessingStatus>(jobId);
        
        if (status) {
          const attempts = (status.attempts || 0) + 1;
          if (attempts < MAX_RETRIES) {
            console.log(`Tentativa ${attempts} de ${MAX_RETRIES} para o job ${jobId}`);
            await kv.set(jobId, {
              ...status,
              attempts,
              lastUpdated: new Date().toISOString(),
              currentStep: `Tentativa ${attempts} de ${MAX_RETRIES}`
            });
            // Tenta novamente com o mesmo jobId
            processS3File(jobId, fileKey, year, month);
          } else {
            console.log(`Job ${jobId} falhou após ${attempts} tentativas`);
            await kv.set(jobId, {
              ...status,
              status: 'error',
              currentStep: 'Erro: número máximo de tentativas excedido',
              error: error.message,
              completedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
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
  try {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'jobId é obrigatório' });
      return;
    }

    // Garantir que o jobId está no formato correto
    if (!jobId.startsWith('process:')) {
      console.log(`Formato de jobId inválido: ${jobId}. Adicionando prefixo 'process:'`);
      const processId = `process:${jobId}`;
      // Redireciona para a URL com o formato correto
      const newUrl = `/process-s3-upload/status/${processId}`;
      res.redirect(307, newUrl);
      return;
    }

    const processId = jobId;

    const status = await kv.get<ProcessingStatus>(processId);
    if (!status) {
      res.status(404).json({ error: 'Status não encontrado' });
      return;
    }

    // Se o processamento ainda estiver em andamento
    if (status.status === 'processing') {
      // Verifica se o progresso está estagnado por mais de 15 segundos
      const now = new Date();
      const lastUpdate = status.lastUpdated ? new Date(status.lastUpdated) : new Date(status.startedAt);
      const timeSinceLastUpdate = now.getTime() - lastUpdate.getTime();

      console.log('Verificando progresso:', {
        processId,
        currentStep: status.currentStep,
        currentProgress: status.progress,
        lastUpdate: lastUpdate.toISOString(),
        timeSinceLastUpdate
      });

      if (timeSinceLastUpdate > 15000) {
        console.log('Detectado processamento paralisado:', {
          processId,
          lastUpdate: lastUpdate.toISOString(),
          timeSinceLastUpdate
        });

        const errorStatus: ProcessingStatus = {
          ...status,
          status: 'error',
          currentStep: 'Erro: processamento paralisado',
          error: 'Processamento paralisado - sem progresso por mais de 15 segundos',
          completedAt: now.toISOString(),
          lastUpdated: now.toISOString()
        };
        await kv.set(processId, errorStatus, { ex: 3600 });
        res.json(errorStatus);
        return;
      }

      // Força o cliente a não usar cache durante o processamento
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.removeHeader('ETag'); // Remove o ETag para evitar 304
      res.json({
        ...status,
        maxTime: MAX_PROCESSING_TIME,
        retryDelay: RETRY_DELAY
      });
      return;
    }

    // Para status finalizados (completed ou error), permite cache
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(status);
  } catch (error: any) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ error: error.message });
  }
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