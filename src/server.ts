import express, { urlencoded } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { mainRouter } from './routers/main'

const server = express()

server.use(helmet())
server.use(cors())
server.use(urlencoded({ extended: true }))
server.use(express.json())

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Servidor rodando em: https://localhost:3000`)
})

server.use(mainRouter)
