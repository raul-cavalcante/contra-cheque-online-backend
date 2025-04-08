import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

console.log('S3 Configuração:', {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_S3_BUCKET_NAME,
});

export const uploadToS3 = async (fileBuffer: Buffer, fileName: string, mimeType: string) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
    ACL: 'public-read',
  };

  try {
    const data = await s3.upload(params).promise();
    return data.Location; // Retorna a URL pública do arquivo
  } catch (error) {
    console.error('Erro ao fazer upload para o S3:', error);
    throw new Error('Erro ao fazer upload para o S3');
  }
};