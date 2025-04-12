import AWS from 'aws-sdk';
import logger from './logger';

// Configuração do cliente S3
const s3Config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
};

const s3 = new AWS.S3(s3Config);

// Registrar a configuração (com redação de dados sensíveis)
logger.info('Configuração do S3 inicializada', {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ? '**REDACTED**' : 'undefined',
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.AWS_S3_BUCKET_NAME || 'contra-cheque-pdf',
});

// Bucket name constante para evitar erros de digitação
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'contra-cheque-pdf';

// Função para verificar se o bucket existe
const checkBucketExists = async (bucketName: string): Promise<boolean> => {
  try {
    logger.info(`Verificando se o bucket ${bucketName} existe`);
    await s3.headBucket({ Bucket: bucketName }).promise();
    logger.info(`Bucket ${bucketName} verificado com sucesso`);
    return true;
  } catch (error: any) {
    logger.error(`Erro ao verificar o bucket ${bucketName}`, {
      errorCode: error.code,
      errorMessage: error.message
    });
    
    // Se o bucket não existe e temos permissão, podemos criá-lo
    if (error.code === 'NotFound' || error.code === 'NoSuchBucket') {
      logger.info(`Tentando criar o bucket ${bucketName}`);
      try {
        await s3.createBucket({
          Bucket: bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: process.env.AWS_REGION || 'us-east-1'
          }
        }).promise();
        logger.info(`Bucket ${bucketName} criado com sucesso`);
        return true;
      } catch (createError: any) {
        logger.error(`Falha ao criar o bucket ${bucketName}`, {
          errorCode: createError.code,
          errorMessage: createError.message
        });
        return false;
      }
    }
    
    return false;
  }
};

/**
 * Função para fazer upload de um arquivo para o S3
 * @param fileBuffer Buffer do arquivo
 * @param fileName Nome do arquivo (incluindo path)
 * @param mimeType Tipo MIME do arquivo
 * @returns URL do arquivo no S3
 */
export const uploadToS3 = async (fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> => {
  const bucketName = BUCKET_NAME;
  logger.info(`Iniciando upload para o S3`, {
    fileName,
    mimeType,
    bucketName,
    fileSize: fileBuffer.length
  });

  // Verificar se o bucket existe antes de fazer o upload
  const bucketExists = await checkBucketExists(bucketName);
  if (!bucketExists) {
    const errorMsg = `Bucket ${bucketName} não encontrado ou inacessível`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Parâmetros para o upload
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
    ACL: 'public-read', // Define o objeto como público
  };

  try {
    // Executar o upload
    logger.info(`Enviando arquivo para o S3`, { fileName });
    const data = await s3.upload(params).promise();
    
    logger.info(`Upload concluído com sucesso`, {
      fileName,
      url: data.Location
    });
    
    return data.Location; // Retorna a URL pública do arquivo
  } catch (error: any) {
    logger.error('Erro ao fazer upload para o S3', {
      errorCode: error.code,
      errorMessage: error.message,
      fileName
    });
    throw new Error(`Erro ao fazer upload para o S3: ${error.message}`);
  }
};