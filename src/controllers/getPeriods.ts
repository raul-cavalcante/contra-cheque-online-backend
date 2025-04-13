import { getPeriodsService } from "../service/getContra_cheques";
import { ExtendedRequest } from "../types/types";
import { Response } from "express";

export const getAvailablePeriods = async (req: ExtendedRequest, res: Response): Promise<void> => {
  console.log('Buscando períodos disponíveis para o usuário');
  if(!req.userId){
    res.status(401).json({error: 'Não autorizado'});
    return;
  }

  const { month, year } = req;

  if (!month || !year || isNaN(Number(month)) || isNaN(Number(year))) {
    res.status(400).json({ error: 'Os parâmetros month e year devem ser números válidos.' });
    return;
  }

  const user = await getPeriodsService(req.userId, Number(month), Number(year));
  
  if(!user){
    res.status(404).json({error: 'Nenhum contra-cheque encontrado'});
    return;
  }
  res.status(200).json(user);
}