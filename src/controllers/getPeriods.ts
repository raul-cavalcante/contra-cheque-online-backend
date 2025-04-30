import { getPeriodsService } from "../service/getContra_cheques";
import { Request, Response } from "express";

export const getAvailablePeriods = async (req: Request, res: Response): Promise<void> => {
  console.log('Buscando períodos disponíveis para o usuário');
  if(!req.userId){
    res.status(401).json({error: 'Não autorizado'});
    return;
  }

  try {
    const periods = await getPeriodsService(req.userId);
    
    if(!periods || periods.length === 0){
      res.status(404).json({error: 'Nenhum período encontrado'});
      return;
    }

    // Transformando os dados para o formato esperado pelo frontend
    const formattedPeriods = periods.map(period => ({
      year: period.year,
      month: period.month
    }));

    res.status(200).json(formattedPeriods);
  } catch (error: any) {
    console.error('Erro ao buscar períodos:', error);
    res.status(500).json({ error: error.message });
  }
}