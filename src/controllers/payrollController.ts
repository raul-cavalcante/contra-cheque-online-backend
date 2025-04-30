import { Request, Response } from 'express';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import { processS3File } from '../service/payrollService';

export const processPayroll = async (req: Request, res: Response): Promise<void> => {
  console.log('Iniciando processamento do contra-cheque');
  try {
    const parsed = uploadPayslipSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { fileKey, year, month } = req.body;

    if (!fileKey) {
      res.status(400).json({ error: 'fileKey é obrigatório' });
      return;
    }

    try {
      // Processar arquivo diretamente
      const result = await processS3File(fileKey, year, month);
      
      res.status(200).json({
        message: 'Arquivo processado com sucesso',
        ...result
      });
    } catch (err) {
      console.error('Erro no processamento:', err);
      res.status(500).json({
        error: 'Erro no processamento do arquivo',
        details: process.env.NODE_ENV === 'development' ? err : undefined
      });
    }
  } catch (error: any) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

