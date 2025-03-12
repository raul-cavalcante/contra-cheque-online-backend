import { z } from 'zod';

export const authSchema = z.object({
  cpf: z.string().length(11, 'CPF deve ter 11 dígitos'),
  password: z.string().length(6, 'Senha deve ter 6 dígitos')
});
