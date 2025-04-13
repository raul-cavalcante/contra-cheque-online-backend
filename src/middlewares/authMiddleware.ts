import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      admin?: any;
    }
  }
}

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction)=> {
  const authHeader = req.headers['authorization']
  if(!authHeader){
    res.status(401).json({error: 'acesso negado'})
    return
  }
  const token = authHeader.split(' ')[1]
  jwt.verify(
    token,
    process.env.JWT_SECRET as string,
    (err, decoded: any) => {
      if(err){
        res.status(500).json({error: 'deu algo errado'})
        return
      }
      next()
    }
  )
};
