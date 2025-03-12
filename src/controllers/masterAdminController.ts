import { Request, Response } from "express";
import {prisma} from "../utils/prisma";
import { z } from "zod";


const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["master", "counter"]).optional() //counter como padrão
});


export const createAdminController = async (req: Request, res: Response) => {
  try {
    const parsed = createAdminSchema.parse(req.body);
    const { email, password, role } = parsed;
    const admin = await prisma.admin.create({
      data: {
        email,
        password,
        role: role || "counter",
      },
    });
    res.json(admin);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const deleteAdminSchema = z.object({
  id: z.string().uuid(),
});

export const deleteAdminController = async (req: Request, res: Response) => {
  try {
    const parsed = deleteAdminSchema.parse(req.params);
    const { id } = parsed;
    const admin = await prisma.admin.delete({ where: { id } });
    res.json(admin);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const listAdminsController = async (req: Request, res: Response) => {
  try {
    const admins = await prisma.admin.findMany();
    res.json(admins);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
