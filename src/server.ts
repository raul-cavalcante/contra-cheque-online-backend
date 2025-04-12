import express, { urlencoded, json } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import path from 'path';
import 'dotenv/config';
import { mainRouter } from './routers/main'
import logger from './utils/logger';
import config from './config/config';

// Inicialização do servidor Express
const server = express()

// Configurando o Express para lidar com tamanhos grandes de payload
server.use(urlencoded({ extended: true, limit: '100mb' }))
server.use(json({ limit: '100mb' }))

// Middlewares de segurança
server.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// Configuração de CORS mais permissiva
const corsOptions = {
  origin: [
    config.server.CORS_ORIGIN,
    'https://contra-cheque-online.vercel.app',
    'https://contra-cheque-online-backend.vercel.app',
    'https://api-contra-cheque-online.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length'],
  credentials: true,
  maxAge: 86400 // Cache para preflight requests (24 horas)
};

server.use(cors(corsOptions));

// Log de todas as requisições
server.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });
  next();
});

// Configuração de diretório de upload
const UPLOAD_DIR = config.server.UPLOAD_DIR;
server.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

logger.info('Configurações do servidor carregadas', {
  port: config.server.PORT,
  uploadDir: UPLOAD_DIR,
  corsOrigin: corsOptions.origin
});

// Configuração das rotas
server.use(mainRouter)

// Inicialização do servidor
const PORT = config.server.PORT;
server.listen(PORT, () => {
  logger.info(`Servidor rodando em: http://localhost:${PORT}`);
  logger.info('API de contra-cheques online iniciada com sucesso');
});
