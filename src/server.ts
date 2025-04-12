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

// Middlewares de segurança e parse de corpo
server.use(helmet())
server.use(cors({
  origin: config.server.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
server.use(urlencoded({ extended: true }))
server.use(json())

// Configuração de diretório de upload
const UPLOAD_DIR = config.server.UPLOAD_DIR;
server.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

logger.info('Configurações do servidor carregadas', {
  port: config.server.PORT,
  uploadDir: UPLOAD_DIR,
  corsOrigin: config.server.CORS_ORIGIN
});

// Configuração das rotas
server.use(mainRouter)

// Inicialização do servidor
const PORT = config.server.PORT;
server.listen(PORT, () => {
  logger.info(`Servidor rodando em: http://localhost:${PORT}`);
  logger.info('API de contra-cheques online iniciada com sucesso');
});
