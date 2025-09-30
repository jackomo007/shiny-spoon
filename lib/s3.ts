import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "crypto"

const region = process.env.AWS_REGION!
const bucket = process.env.S3_BUCKET!

export const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})


export async function uploadPng(buffer: Buffer, prefix = "chart-tracker"): Promise<string> {
  const key = `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.png`

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
    }),
  )

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}


export async function getAvatarPutUrl(
  userId: number,
  contentType: string,
): Promise<{ url: string; publicUrl: string }> {
  const safe = contentType.trim()
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(safe)) {
    throw new Error("Unsupported content type")
  }

  const ext =
    safe === "image/png" ? "png" :
    safe === "image/webp" ? "webp" :
    safe === "image/avif" ? "avif" :
    "jpg"

  const key = `avatars/${userId}/${randomUUID()}.${ext}`

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: safe,
  })

  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 })
  const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
  return { url, publicUrl }
}
