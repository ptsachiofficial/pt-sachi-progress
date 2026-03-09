import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

export async function uploadToR2(buffer: Buffer, fileName: string) {
    const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: 'image/jpeg',
    });

    await s3Client.send(command);

    return `${process.env.R2_PUBLIC_URL}/${fileName}`;
}
