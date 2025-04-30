import { getContraCheques } from "../service/getContra_cheques";
import { Request, Response } from 'express';

export const contra_chequeController = async (req: Request, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }

  const { month, year } = req.query;

  if (!month || !year || isNaN(Number(month)) || isNaN(Number(year))) {
    res.status(400).json({ error: 'Os parâmetros month e year são obrigatórios e devem ser números válidos.' });
    return;
  }

  try {
    const contraCheques = await getContraCheques(req.userId, Number(month), Number(year));
    if (!contraCheques || contraCheques.length === 0) {
      res.status(404).json({ error: 'Nenhum contra-cheque encontrado' });
      return;
    }
    res.status(200).json(contraCheques);
  } catch (error: any) {
    console.error('Erro ao buscar contra-cheques:', error);
    res.status(500).json({ error: error.message });
  }
};