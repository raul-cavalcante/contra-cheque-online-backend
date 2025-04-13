import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      admin?: any;
    }
  }
}

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction) => {
  console.log('Iniciando autenticação do administrador');
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    console.log('Token de autenticação não fornecido');
    res.status(401).json({ error: 'acesso negado' });
    return;
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(
    token,
    process.env.JWT_SECRET as string,
    (err, decoded: any) => {
      if (err) {
        console.log('Erro na autenticação do administrador:', err.message);
        res.status(500).json({ error: 'deu algo errado' });
        return;
      }
      console.log('Administrador autenticado com sucesso');
      next();
    }
  );
};
