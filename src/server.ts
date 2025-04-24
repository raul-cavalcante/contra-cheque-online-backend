import express, { urlencoded } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import path from 'path';
import 'dotenv/config';
import { mainRouter } from './routers/main'

const server = express()

server.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))

// Configuração CORS detalhada
server.use(cors({
  origin: 'https://contra-cheque-online.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Amz-Date',
    'X-Amz-Security-Token',
    'X-Amz-User-Agent'
  ],
  credentials: true,
  maxAge: 3600
}));

server.use(urlencoded({ extended: true, limit: '50mb' }))
server.use(express.json({ limit: '50mb' }))

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
server.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// Middleware para adicionar headers CORS em todas as respostas
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://contra-cheque-online.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Amz-Date, X-Amz-Security-Token, X-Amz-User-Agent');
  next();
});

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:3001`)
})

server.use(mainRouter)
