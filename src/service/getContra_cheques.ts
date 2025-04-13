import { ExtendedRequest } from "../types/types";
import { prisma } from "../utils/prisma";
import { Response } from "express";

interface ContraCheque {
    id: string;
    userId: string;
    createdAt: Date;
    month: number;
    year: number;
    fileUrl: string;
    cpf: string;
}

interface Period {
    userId: string;
    month: number;
    year: number;
}

export const getContraCheques = async (userId: string, month: number, year: number): Promise<ContraCheque[]> => {    
    console.log(`Buscando contra-cheques para o usuário ${userId}, mês ${month}, ano ${year}`);
    if (isNaN(month) || isNaN(year)) {
        throw new Error('Os valores de month e year devem ser números válidos.');
    }

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
    });
    return contraCheques;
}

/**
 * Controller para retornar os períodos disponíveis (ano e mês)
 * para os contra-cheques do usuário autenticado.
 *
 * Esse endpoint agrupa os registros da tabela payslip para o usuário
 * e retorna as combinações distintas de "year" e "month".
 */

export const getPeriodsService = async (userId: string, month: number, year: number): Promise<Period[]> => {    
    console.log(`Buscando períodos disponíveis para o usuário ${userId}, mês ${month}, ano ${year}`);
    const whereClause: any = { userId };

    if (!isNaN(month)) {
        whereClause.month = month;
    }

    if (!isNaN(year)) {
        whereClause.year = year;
    }

    const contraCheques = await prisma.payslip.findMany({
        where: whereClause,
        select: {
            userId: true,
            month: true,
            year: true,
        }
    });
    return contraCheques;
}