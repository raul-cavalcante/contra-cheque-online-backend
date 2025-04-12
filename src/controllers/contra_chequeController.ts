import { getContraCheques } from "../service/getContra_cheques";
import { Request, Response } from 'express';

export const contra_chequeController = async (req: Request, res: Response) => {
  const userId = req.userId as string;
  if (!userId) {
    res.status(401).json({error: 'Não autorizado'});
    return;
  }
  
  const { month, year } = req.query;
  const parsedMonth = month ? Number(month) : undefined;
  const parsedYear = year ? Number(year) : undefined;
  
  if (parsedMonth === undefined || isNaN(parsedMonth) || parsedYear === undefined || isNaN(parsedYear)) {
    res.status(400).json({error: 'Month e year são obrigatórios e devem ser números válidos'});
    return;
  }
  
  try {
    const user = await getContraCheques(userId, parsedMonth, parsedYear);
    
    if(!user || user.length === 0){
      res.status(404).json({error: 'Nenhum contra-cheque encontrado'});
      return;
    }
    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({error: error.message});
  }
}