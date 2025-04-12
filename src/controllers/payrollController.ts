import { Request, Response } from 'express';
import { uploadPayslipSchema } from '../schemas/payslipSchemas';
import { processPayrollPDF } from '../service/payrollService';
import logger from '../utils/logger';

export const uploadPayroll = async (req: Request, res: Response) => {
  logger.info('Iniciando upload de contra-cheque', { 
    route: '/upload/payroll',
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });

  // Validação do schema
  const parsed = uploadPayslipSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn('Erro de validação no schema de upload', { errors: parsed.error.format() });
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const { year, month } = parsed.data;
  logger.info('Dados de período validados', { year, month });

  // Verificação do arquivo
  const file = req.file;
  if (!file) {
    logger.warn('Arquivo não encontrado na requisição');
    res.status(400).json({ error: 'Arquivo é obrigatório' });
    return;
  }

  logger.info('Arquivo recebido com sucesso', { 
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  try {
    // Processamento do PDF
    logger.info('Iniciando processamento do arquivo PDF', { year, month });
    const totalPages = await processPayrollPDF(file.buffer, year, month);
    
    logger.info('Processamento de contra-cheques concluído com sucesso', { 
      totalPages,
      year,
      month
    });

    res.json({ 
      message: 'Contra-cheques processados com sucesso!', 
      pages: totalPages 
    });
  } catch (error: any) {
    logger.error('Erro ao processar o PDF de contra-cheques', { 
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
};

