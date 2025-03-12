import { prisma } from "../utils/prisma";


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
        }
    })
    return contraCheques;
}