import { z } from 'zod';

export const uploadPayslipSchema = z.object({
  year: z.preprocess(val => Number(val), z.number().int()),
  month: z.preprocess(val => Number(val), z.number().int())
});
