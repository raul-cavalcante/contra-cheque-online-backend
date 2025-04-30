import { Request, Response } from 'express';
import { generateToken } from '../utils/jwt';
import {prisma} from '../utils/prisma';

export const login = async (req: Request, res: Response): Promise<void> => {
  console.log('Tentativa de login de usuário');
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

export const updatePassword = async (req: Request, res: Response): Promise<void> => {
  console.log('Atualizando senha do usuário');
  const { newPassword } = req.body;

  try {
    const userId = req.userId; // Certifique-se de que req.userId está sendo populado pelo middleware de autenticação
    const user = await prisma.user.update({
      where: { id: userId },
      data: { password: newPassword },
    });

    res.json({ message: 'Senha atualizada com sucesso.', user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};