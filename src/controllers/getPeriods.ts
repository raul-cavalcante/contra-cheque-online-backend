import { getPeriodsService } from "../service/getContra_cheques";
import { ExtendedRequest } from "../types/types";
import { Response } from "express";

export const getAvailablePeriods= async (req: ExtendedRequest, res: Response) => {
  if(!req.userId){
    res.status(401).json({error: 'Não autorizado'});
    return;
  }
  const user = await getPeriodsService(req.userId, req.month, req.year);
  
  if(!user){
    res.status(404).json({error: 'Nenhum contra-cheque encontrado'});
    return;
  }
  res.status(200).json(user);
}