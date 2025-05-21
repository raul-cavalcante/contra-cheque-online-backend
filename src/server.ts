import express, { urlencoded } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import path from 'path';
import 'dotenv/config';
import { mainRouter } from './routers/main'

const server = express()

// Configuração do Helmet
server.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))

// Configuração CORS detalhada
const corsOptions = {
  origin: ['https://contra-cheque-online.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Requested-With',
    'If-None-Match',
    'If-Modified-Since',
    'Cache-Control'
  ],
  exposedHeaders: ['ETag'],
  credentials: true,
  maxAge: 86400
};

server.use(cors(corsOptions));

// Middleware para preflight requests
server.options('*', cors(corsOptions));

server.use(urlencoded({ extended: true, limit: '50mb' }))
server.use(express.json({ limit: '50mb' }))

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
server.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// Middleware para adicionar headers CORS em todas as respostas
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://contra-cheque-online.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, If-None-Match, If-Modified-Since, Cache-Control');
  res.header('Access-Control-Expose-Headers', 'ETag');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handling preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(204); // Usando 204 em vez de 200 para preflight
    return;
  }
  
  next();
});

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`)
})

server.use(mainRouter)
