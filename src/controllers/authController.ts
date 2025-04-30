import { Request, Response } from 'express';
import { generateToken } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { z } from 'zod';

const loginSchema = z.object({
  cpf: z.string().min(11).max(14),
  password: z.string()
});

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const updatePasswordSchema = z.object({
  newPassword: z.string().min(6)
});

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  console.log('Tentativa de login de usuário');
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { cpf, password } = parsed.data;
    const cleanCpf = cpf.replace(/\D/g, '');

    const user = await prisma.user.findUnique({ 
      where: { 
        cpf: cleanCpf,
        password 
      } 
    });

    if (!user) {
      res.status(401).json({ error: 'CPF ou senha inválidos.' });
      return;
    }

    const token = generateToken(user.id);
    res.json({ token, user });
    
  } catch (error: any) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: error.message });
  }
};

export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
  console.log('Tentativa de login de administrador');
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { email, password } = parsed.data;
    const admin = await prisma.admin.findUnique({ 
      where: { 
        email,
        password 
      } 
    });

    if (!admin) {
      res.status(401).json({ error: 'Email ou senha inválidos.' });
      return;
    }

    const token = generateToken(admin.id);
    res.json({ token, admin });

  } catch (error: any) {
    console.error('Erro no login de admin:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updatePassword = async (req: Request, res: Response): Promise<void> => {
  console.log('Atualizando senha do usuário');
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const parsed = updatePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { newPassword } = parsed.data;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { password: newPassword },
    });

    res.json({ message: 'Senha atualizada com sucesso', user });
  } catch (error: any) {
    console.error('Erro ao atualizar senha:', error);
    res.status(500).json({ error: error.message });
  }
};