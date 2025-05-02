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
const processingStatus = new Map<string, any>();

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
    
    // Retorna imediatamente com status 202
    res.status(202).json({
      message: 'Processamento iniciado',
      jobId,
      status: 'processing',
      fileUrl: getPublicS3Url(fileKey)
    });

    // Processa em background
    processingStatus.set(jobId, { 
      status: 'processing',
      progress: 0,
      startedAt: new Date().toISOString()
    });
    
    processS3File(fileKey, year, month)
      .then(result => {
        console.log('Processamento concluído com sucesso:', result);
        processingStatus.set(jobId, { 
          status: 'completed',
          result,
          completedAt: new Date().toISOString()
        });
      })
      .catch(error => {
        console.error('Erro no processamento:', error);
        processingStatus.set(jobId, { 
          status: 'error',
          error: error.message,
          completedAt: new Date().toISOString()
        });
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

  // Limpa status antigos se completed ou error
  if (status.status === 'completed' || status.status === 'error') {
    setTimeout(() => {
      processingStatus.delete(jobId);
    }, 3600000); // Limpa após 1 hora
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