import express, { urlencoded } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import path from 'path';
import 'dotenv/config';
import { mainRouter } from './routers/main'

const server = express()

server.use(helmet())
server.use(cors())
server.use(urlencoded({ extended: true }))
server.use(express.json())
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
server.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

server.use(cors({
  origin: 'http://localhost:3000', // URL do seu frontend Next.js
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:3001`)
})

server.use(mainRouter)
