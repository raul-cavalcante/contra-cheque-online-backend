import { ExtendedRequest } from "../types/types";
import { prisma } from "../utils/prisma";
import { Response } from "express";

export const getContraCheques = async (userId, month, year) => {	
    const contraCheques = await prisma.payslip.findMany({
        where: {
            userId,
            month,
            year,
        },
        select: {
            id: true,
            userId: true,
            createdAt: true,
            month: true,
            year: true,
            fileUrl: true,
            cpf: true,
        }
    })
    return contraCheques;
}

/**
 * Controller para retornar os períodos disponíveis (ano e mês)
 * para os contra-cheques do usuário autenticado.
 *
 * Esse endpoint agrupa os registros da tabela payslip para o usuário
 * e retorna as combinações distintas de "year" e "month".
 */

export const getPeriodsService = async (userId, month, year) => {	
    const contraCheques = await prisma.payslip.findMany({
        where: {
            userId,
            month,
            year,
        },
        select: {
            userId: true,
            month: true,
            year: true,
        }
    })
    return contraCheques;
}