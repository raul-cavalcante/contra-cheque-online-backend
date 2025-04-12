import AWS from 'aws-sdk';
import logger from './logger';
import config from '../config/config';

// Configuração do cliente S3 com timeout aumentado
const s3Config = {
  accessKeyId: config.s3.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.s3.AWS_SECRET_ACCESS_KEY,
  region: config.s3.AWS_REGION,
  httpOptions: {
    timeout: 300000, // 5 minutos para uploads grandes
    connectTimeout: 10000 // 10 segundos para conexão
  },
  maxRetries: 3 // Tentativas automáticas em caso de falha
};

// Inicialização do cliente S3
const s3 = new AWS.S3(s3Config);

// Registrar a configuração (com redação de dados sensíveis)
logger.info('Configuração do S3 inicializada', {
  accessKeyId: config.s3.AWS_ACCESS_KEY_ID ? '**REDACTED**' : 'undefined',
  region: config.s3.AWS_REGION,
  bucket: config.s3.AWS_S3_BUCKET_NAME,
  hasSecretKey: !!config.s3.AWS_SECRET_ACCESS_KEY
});

// Validar as credenciais do S3
const validateS3Credentials = async (): Promise<boolean> => {
  try {
    if (!config.s3.AWS_ACCESS_KEY_ID || !config.s3.AWS_SECRET_ACCESS_KEY) {
      logger.error('Credenciais do AWS S3 não configuradas');
      return false;
    }
    
    logger.info('Validando credenciais do AWS S3...');
    // Listagem de buckets como teste de autenticação
    await s3.listBuckets().promise();
    logger.info('Credenciais do AWS S3 validadas com sucesso');
    return true;
  } catch (error: any) {
    logger.error('Erro ao validar credenciais do AWS S3', {
      error: error.message,
      code: error.code
    });
    return false;
  }
};

// Executar validação ao inicializar
validateS3Credentials().catch(err => {
  logger.error('Falha ao inicializar validação do S3', { error: err.message });
});

// Bucket name constante para evitar erros de digitação
const BUCKET_NAME = config.s3.AWS_S3_BUCKET_NAME;

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
            LocationConstraint: config.s3.AWS_REGION
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
  
  if (!fileBuffer || fileBuffer.length === 0) {
    const errorMsg = 'Buffer do arquivo vazio ou inválido';
    logger.error(errorMsg, { fileName });
    throw new Error(errorMsg);
  }
  
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
    logger.info(`Enviando arquivo para o S3`, { 
      fileName,
      contentType: mimeType,
      size: fileBuffer.length
    });
    
    const data = await s3.upload(params).promise();
    
    logger.info(`Upload concluído com sucesso`, {
      fileName,
      url: data.Location,
      etag: data.ETag
    });
    
    return data.Location; // Retorna a URL pública do arquivo
  } catch (error: any) {
    logger.error('Erro ao fazer upload para o S3', {
      errorCode: error.code,
      errorMessage: error.message,
      errorStack: error.stack,
      fileName,
      size: fileBuffer.length
    });
    throw new Error(`Erro ao fazer upload para o S3: ${error.message}`);
  }
};