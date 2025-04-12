// Centraliza todas as configurações do sistema
// importando variáveis de ambiente e definindo valores padrão

import dotenv from 'dotenv';
import path from 'path';

// Carrega as variáveis de ambiente do arquivo .env se estiver no ambiente de desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Configurações do servidor
export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3001,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
};

// Configurações de segurança e JWT
export const SECURITY_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'sua_chave_secreta_padrao',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  PASSWORD_SALT_ROUNDS: 10,
};

// Configurações do AWS S3
export const S3_CONFIG = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || 'contra-cheque-pdf',
};

// Configurações do Redis para filas
export const REDIS_CONFIG = {
  HOST: process.env.REDIS_HOST || '127.0.0.1',
  PORT: Number(process.env.REDIS_PORT) || 6379,
  PASSWORD: process.env.REDIS_PASSWORD || undefined,
};

// Configurações de upload
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_MIME_TYPES: ['application/pdf'],
};

// Exporta todas as configurações como um único objeto
export default {
  server: SERVER_CONFIG,
  security: SECURITY_CONFIG,
  s3: S3_CONFIG,
  redis: REDIS_CONFIG,
  upload: UPLOAD_CONFIG,
}; 