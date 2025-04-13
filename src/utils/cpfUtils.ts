export const cleanCPF = (cpf: string) => {
  console.log('Limpando CPF:', cpf);
  return cpf.replace(/\D/g, '');
};

export const generateInitialPassword = (cpf: string) => {
  console.log('Gerando senha inicial para CPF:', cpf);
  const digits = cleanCPF(cpf);
  return digits.substring(0, 6);
};

export const comparePasswords = (cpf: string, senha: string) => {
  console.log('Comparando senhas para CPF:', cpf);
  const initialPassword = generateInitialPassword(cpf);
  return senha === initialPassword;
};
