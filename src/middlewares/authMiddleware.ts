import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      admin?: any;
    }
  }
}

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction) => {
  logger.info('Verificando autenticação de administrador');
  
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
    process.env.JWT_SECRET as string,
    (err, decoded: any) => {
      if (err) {
        logger.warn('Token de administrador inválido', { 
          error: err.message,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        res.status(401).json({ error: 'Acesso negado: Token inválido' });
        return;
      }
      
      // Armazenar o ID do admin no objeto da requisição
      req.admin = decoded;
      
      logger.info('Administrador autenticado com sucesso', {
        adminId: decoded.id,
        path: req.path
      });
      
      next();
    }
  );
};
