import { Request, Response } from 'express';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import multer from 'multer';
import { s3Client, getPublicS3Url } from '../utils/s3Utils';
import { processS3File } from '../service/payrollService';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } 
});

// Cache para armazenar o status do processamento
const processingStatus = new Map<string, {
  status: 'queued' | 'processing' | 'completed' | 'error';
  startTime: number;
  progress: number;
  error?: string;
  result?: any;
  etag?: string;
  lastModified?: string;
}>();

// Configurações
const MAX_PROCESSING_TIME = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hora

// Limpa status antigos periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [jobId, status] of processingStatus.entries()) {
    if (status.status === 'completed' || status.status === 'error') {
      if (now - status.startTime > CLEANUP_INTERVAL) {
        processingStatus.delete(jobId);
      }
    } else if (status.status === 'processing') {
      if (now - status.startTime > MAX_PROCESSING_TIME) {
        status.status = 'error';
        status.error = 'Tempo máximo de processamento excedido';
      }
    }
  }
}, CLEANUP_INTERVAL);

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

    const jobId = `${year}-${month}-${Date.now()}`;
    
    // Inicia status do processamento
    processingStatus.set(jobId, {
      status: 'processing',
      startTime: Date.now(),
      progress: 0,
    });

    res.status(202).json({
      message: 'Processamento iniciado',
      jobId,
      status: 'processing',
      fileUrl: getPublicS3Url(fileKey)
    });

    // Processa em background
    try {
      const result = await processS3File(fileKey, year, month);
      processingStatus.set(jobId, {
        status: 'completed',
        startTime: Date.now(),
        progress: 100,
        result
      });
    } catch (error: any) {
      console.error('Erro no processamento:', error);
      processingStatus.set(jobId, {
        status: 'error',
        startTime: Date.now(),
        progress: 0,
        error: error.message
      });
    }

  } catch (error: any) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

export const checkProcessingStatus = async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;
  const ifNoneMatch = req.headers['if-none-match'];
  
  if (!jobId) {
    res.status(400).json({ error: 'jobId é obrigatório' });
    return;
  }

  const status = processingStatus.get(jobId);
  
  if (!status) {
    res.status(404).json({ error: 'Job não encontrado' });
    return;
  }

  // Gera ETag baseado no estado atual
  const currentEtag = `"${Buffer.from(JSON.stringify(status)).toString('base64')}"`;

  // Verifica se o conteúdo foi modificado
  if (ifNoneMatch === currentEtag) {
    res.status(304).end();
    return;
  }

  // Define headers para controle de cache
  res.setHeader('ETag', currentEtag);
  
  if (status.status === 'processing') {
    // Para processamento em andamento, não permite cache
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Retry-After', '3'); // Sugere aguardar 3 segundos
  } else {
    // Para status final (completed/error), permite cache por 1 hora
    res.setHeader('Cache-Control', 'private, max-age=3600');
  }

  // Remove status antigos se completo ou com erro
  if (status.status === 'completed' || status.status === 'error') {
    setTimeout(() => {
      processingStatus.delete(jobId);
    }, CLEANUP_INTERVAL);
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