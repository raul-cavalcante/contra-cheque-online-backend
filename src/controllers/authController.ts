import { Request, Response } from 'express';
import { generateToken } from '../utils/jwt';
import {prisma} from '../utils/prisma';


export const loginUser = async (req: Request, res: Response) => {
  const { cpf, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { cpf, password } });
    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const token = generateToken(user.id)
    res.json({token, user})
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


export const loginAdmin = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const admin = await prisma.admin.findUnique({ where: { email, password } });
    if (!admin) {
      res.status(401).json({ error: 'Admin não encontrado.' });
      return;
    }

    const token = generateToken(admin.id)
    res.json({token, admin})

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

