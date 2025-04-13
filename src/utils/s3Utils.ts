import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Função para verificar se o bucket existe
const checkBucketExists = async (bucketName: string) => {
  try {
    await s3.headBucket({ Bucket: bucketName }).promise();
    console.log(`Bucket ${bucketName} verificado com sucesso.`);
  } catch (error) {
    console.error(`Erro ao verificar o bucket ${bucketName}:`, error);
    throw new Error(`Bucket ${bucketName} não encontrado ou inacessível.`);
  }
};

export const uploadToS3 = async (fileBuffer: Buffer, fileName: string, mimeType: string) => {
  console.log(`Iniciando upload para o S3: ${fileName}`);
  const bucketName = process.env.AWS_S3_BUCKET_NAME!;

  // Verifica se o bucket existe antes de fazer o upload
  await checkBucketExists(bucketName);

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
    ACL: 'public-read', // Define o objeto como público
  };

  try {
    const data = await s3.upload(params).promise();
    return data.Location; // Retorna a URL pública do arquivo
  } catch (error) {
    console.error('Erro ao fazer upload para o S3:', error);
    throw new Error('Erro ao fazer upload para o S3');
  }
};