import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import logger from './logger';

/**
 * Gera um novo token JWT para o usuário
 * @param id ID do usuário
 * @returns Token JWT assinado
 */
export const generateToken = (id: string): string => {
  logger.info('Gerando token JWT', { userId: id });
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret');
};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Middleware para verificar a autenticidade do token JWT
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  logger.info('Verificando token de autenticação', { 
    path: req.path,
    method: req.method
  });
  
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    logger.warn('Token de autenticação não fornecido', { 
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    res.status(401).json({ error: 'Acesso negado: Token não fornecido' });
    return;
  }
  
  const token = authHeader.split(' ')[1];

  jwt.verify(
    token,
    process.env.JWT_SECRET || 'secret',
    (err, decoded: any) => {
      if (err) {
        logger.warn('Token inválido', { 
          error: err.message,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(401).json({ error: 'Acesso negado: Token inválido' });
        return;
      }
      
      req.userId = decoded.id;
      
      logger.info('Usuário autenticado com sucesso', { 
        userId: decoded.id,
        path: req.path
      });
      
      next();
    }
  );
};