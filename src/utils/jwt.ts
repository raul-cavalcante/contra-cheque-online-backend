import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ExtendedRequest } from '../types/types';

export const generateToken = (id: string) => {
  console.log('Gerando token para o ID:', id);
  return jwt.sign({ id }, process.env.JWT_SECRET as string);
};

declare global {
  namespace Express {
    interface Request {
      userId?: any;
      month: Number;
      year: any;
      password: any;
      id: any;
    }
  }
}

export const verifyToken = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  console.log('Iniciando verificação do token');
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    console.log('Token não fornecido');
    res.status(401).json({ error: 'acesso negado' });
    return;
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(
    token,
    process.env.JWT_SECRET as string,
    (err, decoded: any) => {
      if (err) {
        console.log('Token inválido:', err.message);
        res.status(500).json({ error: 'token inválido' });
        return;
      }
      console.log('Token verificado com sucesso para o ID:', decoded.id);
      req.userId = decoded.id; // Use req.userId para consistência
      next();
    }
  );
};