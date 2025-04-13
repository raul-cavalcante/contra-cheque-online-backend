-- Remover a restrição unique do campo cpf na tabela Payslip
ALTER TABLE "Payslip" DROP CONSTRAINT IF EXISTS "Payslip_cpf_key";

-- Adicionar restrição única composta para cpf, year e month
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_cpf_year_month_key" UNIQUE ("cpf", "year", "month"); 