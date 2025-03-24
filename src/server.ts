import express, { urlencoded } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { mainRouter } from './routers/main'

const server = express()

server.use(helmet())
server.use(cors())
server.use(urlencoded({ extended: true }))
server.use(express.json())

server.use(cors({
  origin: 'http://localhost:3000', // URL do seu frontend Next.js
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Servidor rodando em: https://localhost:3001`)
})

server.use(mainRouter)
