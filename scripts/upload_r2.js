import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

export async function uploadToR2(filePath) {
    const fileName = path.basename(filePath);
    const fileStream = fs.createReadStream(filePath);

    await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `charts/${fileName}`,
        Body: fileStream,
        ContentType: "image/jpeg",
    }));

    // Construct the public URL
    // Public domain from env: https://pub-868320e01a0b47a096e3d64c8857288c.r2.dev
    return `${process.env.R2_PUBLIC_DOMAIN}/charts/${fileName}`;
}

const file = process.argv[2];
if (file) {
    uploadToR2(file)
        .then(url => console.log(url))
        .catch(err => {
            console.error("Upload failed:", err);
            process.exit(1);
        });
}
