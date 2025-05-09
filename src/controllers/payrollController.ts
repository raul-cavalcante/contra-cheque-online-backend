import { Request, Response } from 'express';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import { processS3File } from '../service/payrollService';
import { uploadToS3 } from '../utils/s3Utils';

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
    }    try {
      const processId = `process:${year}-${month}-${Date.now()}`;
      // Processar arquivo diretamente
      const result = await processS3File(processId, fileKey, year, month);
      
      res.status(200).json({
        message: 'Arquivo processado com sucesso',
        processId,
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

export const uploadPayroll = async (req: Request, res: Response): Promise<void> => {
  console.log('Iniciando upload do contra-cheque');
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    const { year, month } = req.body;
    const parsed = uploadPayslipSchema.safeParse({ year: Number(year), month: Number(month) });
    
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    try {
      // Upload do arquivo para o S3
      const fileKey = `uploads/${year}-${month}.pdf`;
      await uploadToS3(file.buffer, fileKey, 'application/pdf');      // Processar o arquivo após o upload
      const processId = `process:${year}-${month}-${Date.now()}`;
      const result = await processS3File(processId, fileKey, Number(year), Number(month));
      
      res.status(200).json({
        message: 'Arquivo processado com sucesso',
        processId,
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

export const checkJobStatus = async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;
  
  try {
    // Como o processamento é síncrono agora, sempre retornamos completed
    res.json({
      status: 'completed',
      message: 'Processamento concluído'
    });
  } catch (error: any) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ error: error.message });
  }
};

