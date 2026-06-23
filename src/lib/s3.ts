import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsCredentialsProvider } from "@vercel/functions/oidc";

const BUCKET = process.env.S3_PHOTOS_BUCKET;
const REGION = process.env.S3_PHOTOS_REGION || "eu-west-1";
const ROLE_ARN = process.env.S3_PHOTOS_ROLE_ARN;

export const photosConfigured = Boolean(BUCKET && (ROLE_ARN || !process.env.VERCEL));

let client: S3Client | null = null;
function s3(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: REGION,
    // On Vercel: assume the IAM role via OIDC (keyless). Locally: fall back to
    // the default credential chain (e.g. AWS_PROFILE=cefani-staging via SSO).
    credentials:
      process.env.VERCEL && ROLE_ARN
        ? awsCredentialsProvider({ roleArn: ROLE_ARN })
        : undefined,
  });
  return client;
}

export async function putPhoto(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "private, max-age=31536000",
    }),
  );
}

export async function deletePhoto(key: string): Promise<void> {
  await s3()
    .send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
    .catch(() => {});
}

/** Short-lived signed URL for viewing a private object (default 1h). */
export async function presignGet(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  );
}
