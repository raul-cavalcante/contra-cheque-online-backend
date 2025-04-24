import { Request, Response } from 'express';
import { PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import payrollQueue from '../queues/payrollQueue';
import multer from 'multer';
import { s3Client } from '../utils/s3Utils';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } 
});

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
      ACL: 'private'
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
      signableHeaders: new Set(['content-type', 'host'])
    });

    console.log('URL pré-assinada gerada com sucesso:', url);

    res.json({
      uploadUrl: url,
      fileKey,
      year,
      month,
      expiresIn: 300,
      contentType,
      requiredHeaders: {
        'Content-Type': contentType
      }
    });
  } catch (error: any) {
    console.error('Erro ao gerar URL pré-assinada:', error);
    res.status(500).json({ error: error.message });
  }
};

export const processS3Upload = async (req: Request, res: Response): Promise<void> => {
  console.log('Iniciando processamento de upload no S3:', req.body);
  try {
    const { fileKey } = req.body;
    const parsed = uploadPayslipSchema.safeParse(req.body);

    if (!parsed.success) {
      console.error('Erro na validação dos dados:', parsed.error.format());
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    if (!fileKey) {
      console.error('Erro: fileKey não fornecido na requisição');
      res.status(400).json({ error: 'fileKey é obrigatório' });
      return;
    }

    const { year, month } = parsed.data;
    console.log(`Dados validados com sucesso: year=${year}, month=${month}, fileKey=${fileKey}`);

    try {
      console.log(`Verificando existência do arquivo no S3: ${fileKey}`);
      const headCommand = new HeadObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: fileKey
      });
      await s3Client.send(headCommand);
      console.log(`Arquivo encontrado no S3: ${fileKey}`);
    } catch (err) {
      console.error(`Erro: Arquivo não encontrado no S3: ${fileKey}`, err);
      res.status(404).json({ error: 'Arquivo não encontrado no S3' });
      return;
    }

    try {
      console.log('Adicionando job à fila para processamento:', { fileKey, year, month });
      const job = await payrollQueue.add(
        'processS3File',
        {
          fileKey,
          year,
          month
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          removeOnComplete: true
        }
      );
      console.log('Job adicionado com sucesso à fila:', job.id);

      res.status(202).json({
        message: 'Processamento do contra-cheque iniciado com sucesso!',
        jobId: job.id,
        status: 'processing'
      });
    } catch (err) {
      console.error('Erro ao adicionar job à fila:', err);
      res.status(500).json({ error: 'Erro ao adicionar job à fila' });
    }
  } catch (error: any) {
    console.error('Erro ao iniciar processamento:', error);
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