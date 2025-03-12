import { NextFunction,Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ExtendedRequest } from '../types/types';

export const generateToken = (id: string) => {
  return jwt.sign({id}, process.env.JWT_SECRET as string);
};


declare global {
  namespace Express {
    interface Request {
      userId?: String;
      month: Number;
      year: Number;
    }
  }
}

export const verifyToken = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if(!authHeader){
    res.status(401).json({error: 'acesso negado'});
    return;
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(
    token,
    process.env.JWT_SECRET as string,
    (err, decoded: any) => {
      if(err){
        res.status(500).json({error: 'token inválido'});
        return
      }
      req.userId = decoded.id;
      next();
    }
  )
}