import { z } from 'zod';

export const uploadPayslipSchema = z.object({
  year: z.preprocess(val => Number(val), z.number().int()),
  month: z.preprocess(val => Number(val), z.number().int()),
  cpf: z.string().min(11).max(14)
});
