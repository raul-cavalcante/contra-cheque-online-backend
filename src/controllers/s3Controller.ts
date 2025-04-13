import { Request, Response } from 'express';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import payrollQueue from '../queues/payrollQueue';
import multer from 'multer';

// Configuração do cliente S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // Limite de 50MB
});

/**
 * Gera uma URL pré-assinada para upload direto para o S3
 */
export const getPresignedUrl = async (req: Request, res: Response): Promise<void> => {
  console.log('Recebendo requisição para gerar URL pré-assinada:', req.body);
  try {
    // Validar os dados recebidos
    const parsed = uploadPayslipSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Erro na validação dos dados:', parsed.error.format());
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { year, month } = parsed.data;
    console.log(`Dados validados com sucesso: year=${year}, month=${month}`);

    const contentType = req.body.contentType || 'application/pdf';

    // Gerar um nome único para o arquivo sem o CPF
    const fileKey = `uploads/${year}-${month}.pdf`;
    console.log(`Gerando URL pré-assinada para o arquivo: ${fileKey}`);

    // Gerar URL pré-assinada para upload
    const presignedUrl = s3.getSignedUrl('putObject', {
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileKey,
      ContentType: contentType,
      Expires: 300, // URL válida por 5 minutos
    });

    console.log('URL pré-assinada gerada com sucesso:', presignedUrl);

    // Retornar a URL e metadados
    res.json({
      uploadUrl: presignedUrl,
      fileKey,
      year,
      month,
      expiresIn: 300 // 5 minutos
    });
  } catch (error: any) {
    console.error('Erro ao gerar URL pré-assinada:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Inicia o processamento de um arquivo já enviado ao S3
 */
export const processS3Upload = async (req: Request, res: Response): Promise<void> => {
  console.log('Iniciando processamento de upload no S3:', req.body);
  try {
    // Validar os dados recebidos
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

    // Verificar se o arquivo existe no S3
    try {
      console.log(`Verificando existência do arquivo no S3: ${fileKey}`);
      await s3.headObject({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: fileKey
      }).promise();
      console.log(`Arquivo encontrado no S3: ${fileKey}`);
    } catch (err) {
      console.error(`Erro: Arquivo não encontrado no S3: ${fileKey}`, err);
      res.status(404).json({ error: 'Arquivo não encontrado no S3' });
      return;
    }

    // Adicionar job à fila para processamento assíncrono
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

      // Retornar ID do job para acompanhamento
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