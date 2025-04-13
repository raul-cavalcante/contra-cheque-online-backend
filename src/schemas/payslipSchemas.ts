import { z } from 'zod';

export const uploadPayslipSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12)
}); // Removido o campo `cpf` completamente
