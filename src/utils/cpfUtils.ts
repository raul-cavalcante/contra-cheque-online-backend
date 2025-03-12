
export const cleanCPF = (cpf: string) => cpf.replace(/\D/g, '');


export const generateInitialPassword = (cpf: string) => {
  const digits = cleanCPF(cpf);
  return digits.substring(0, 6);
};


export const comparePasswords = (cpf: string, senha: string) => {
  const initialPassword = generateInitialPassword(cpf);
  return senha === initialPassword;
};
