# 🧾 Contracheque Online - Backend

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

## 📋 Sobre o Projeto

Sistema backend para gerenciamento e distribuição de contracheques digitais. Processa PDFs de contracheques, extrai informações automaticamente e disponibiliza acesso seguro aos funcionários.

### 🌟 Principais Funcionalidades

- 📄 Processamento automático de PDFs de contracheques
- 🔍 Extração inteligente de CPF e dados
- 🔐 Autenticação segura de usuários
- 📱 API RESTful para acesso mobile/web
- ☁️ Integração com AWS Lambda para processamento escalável
- 📊 Gerenciamento de períodos e histórico

## 🚀 Tecnologias

- **Node.js** - Runtime JavaScript
- **TypeScript** - Linguagem principal
- **Prisma** - ORM e gerenciamento de banco de dados
- **PostgreSQL** - Banco de dados
- **AWS Lambda** - Processamento serverless
- **Docker** - Containerização
- **AWS S3** - Armazenamento de arquivos
- **Express** - Framework web

## 🛠️ Configuração do Ambiente

### Pré-requisitos

- Node.js 18+
- PostgreSQL
- Docker
- Conta AWS

### Instalação

1. Clone o repositório:
\`\`\`bash
git clone https://github.com/raul-cavalcante/contra-cheque-online.git
cd contra-cheque-online-backend
\`\`\`

2. Instale as dependências:
\`\`\`bash
npm install
\`\`\`

3. Configure as variáveis de ambiente:
\`\`\`bash
cp .env.example .env
# Configure suas variáveis no arquivo .env
\`\`\`

4. Execute as migrações do banco:
\`\`\`bash
npx prisma migrate dev
\`\`\`

5. Inicie o servidor:
\`\`\`bash
npm run dev
\`\`\`

## 🐳 Docker

Para executar usando Docker:

\`\`\`bash
docker build -t contra-cheque-lambda .
docker run -p 3001:3001 contra-cheque-lambda
\`\`\`

## 📚 Documentação da API

### Endpoints Principais

- 🔑 **Auth**
  - \`POST /login/user\` - Login de usuário
  - \`POST /login/admin\` - Login administrativo

- 📄 **Contracheques**
  - \`GET /contra-cheques\` - Lista contracheques do usuário
  - \`GET /yearMonth\` - Obtém períodos disponíveis

- ⬆️ **Upload**
  - \`POST /presigned-url\` - Gera URL para upload S3
  - \`POST /process-s3-upload\` - Processa arquivo do S3

## 🔒 Segurança

- Autenticação via JWT
- Validação de dados com Zod
- CORS configurado
- Criptografia de senhas
- Controle de acesso por perfil

## 📈 Escalabilidade

- Processamento assíncrono via Lambda
- Cache com Vercel KV
- Upload direto para S3
- Containerização com Docker

## 👥 Contribuição

1. Fork o projeto
2. Crie sua branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit suas mudanças (\`git commit -m 'Add some AmazingFeature'\`)
4. Push para a branch (\`git push origin feature/AmazingFeature\`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença ISC.

## 📧 Contato

Raul Cavalcante - [raulcavalcante.a@gmail.com](mailto:raulcavalcante.a@gmail.com)

---

Desenvolvido por Raul Cavalcante
