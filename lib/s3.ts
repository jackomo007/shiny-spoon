import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { randomUUID } from "crypto"

const client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})
const bucket = process.env.S3_BUCKET!

export async function uploadPng(buffer: Buffer, prefix = "chart-tracker") {
  const key = `${prefix}/${new Date().toISOString().slice(0,10)}/${randomUUID()}.png`
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: "image/png",
  }))
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}
