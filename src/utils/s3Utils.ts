import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  forcePathStyle: true
});

// Função para verificar se o bucket existe
const checkBucketExists = async (bucketName: string) => {
  try {
    const command = new HeadBucketCommand({ Bucket: bucketName });
    await s3Client.send(command);
    console.log(`Bucket ${bucketName} verificado com sucesso.`);
  } catch (error) {
    console.error(`Erro ao verificar o bucket ${bucketName}:`, error);
    throw new Error(`Bucket ${bucketName} não encontrado ou inacessível.`);
  }
};

export const generatePresignedUrl = async (fileName: string, contentType: string) => {
  const bucketName = process.env.AWS_S3_BUCKET_NAME!;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      ContentType: contentType
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
      signableHeaders: new Set(['host'])
    });

    return signedUrl;
  } catch (error) {
    console.error('Erro ao gerar URL pré-assinada:', error);
    throw error;
  }
};

export const uploadToS3 = async (fileBuffer: Buffer, fileName: string, contentType: string) => {
  const bucketName = process.env.AWS_S3_BUCKET_NAME!;

  await checkBucketExists(bucketName);

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType
    });

    await s3Client.send(command);
    return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error('Erro ao fazer upload para o S3:', error);
    throw error;
  }
};

export { s3Client };