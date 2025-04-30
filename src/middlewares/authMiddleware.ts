import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';

declare global {
  namespace Express {
    interface Request {
      admin?: any;
      adminId?: string;
      userId?: any;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  console.log('Verificando token de autenticação');
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, process.env.JWT_SECRET as string, (err: any, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Token inválido' });
      return;
    }
    
    req.userId = decoded.id;
    next();
  });
};

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
      req.adminId = decoded.id;
      console.log('Administrador autenticado com sucesso');
      next();
    }
  );
};

export const authenticateMasterAdmin = async (req: Request, res: Response, next: NextFunction) => {
  console.log('Verificando se é um admin master');
  if (!req.adminId) {
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId }
    });

    if (!admin || admin.role !== 'master') {
      res.status(403).json({ error: 'Acesso permitido apenas para admin master' });
      return;
    }

    next();
  } catch (error) {
    console.error('Erro ao verificar admin master:', error);
    res.status(500).json({ error: 'Erro ao verificar permissões' });
  }
};
