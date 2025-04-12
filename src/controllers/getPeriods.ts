import { getPeriodsService } from "../service/getContra_cheques";
import { Request, Response } from "express";

export const getAvailablePeriods = async (req: Request, res: Response) => {
  const userId = req.userId as string;
  if(!userId){
    res.status(401).json({error: 'Não autorizado'});
    return;
  }

  // Os parâmetros month e year são opcionais para esta rota
  const { month, year } = req.query;
  const parsedMonth = month ? Number(month) : undefined;
  const parsedYear = year ? Number(year) : undefined;
  
  // Verificar se os valores são válidos quando fornecidos
  if ((month && (isNaN(parsedMonth!) || parsedMonth === undefined)) || 
      (year && (isNaN(parsedYear!) || parsedYear === undefined))) {
    res.status(400).json({error: 'Month e year, quando fornecidos, devem ser números válidos'});
    return;
  }

  try {
    const user = await getPeriodsService(userId, parsedMonth, parsedYear);
    
    if(!user || user.length === 0){
      res.status(404).json({error: 'Nenhum período encontrado'});
      return;
    }
    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({error: error.message});
  }
}