import { Request, Response } from 'express';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import { processPayrollPDF } from '../service/payrollService';


export const uploadPayroll = async (req: Request, res: Response) => {
  const parsed = uploadPayslipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const { year, month } = parsed.data;
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Arquivo é obrigatório' });
    return;
  }
  try {
    const totalPages = await processPayrollPDF(file.buffer, year, month);
    res.json({ message: 'Contra-cheques processados com sucesso!', pages: totalPages });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

