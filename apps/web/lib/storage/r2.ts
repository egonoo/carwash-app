import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let _client: S3Client | null = null;

function client(): S3Client {
  if (_client) return _client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials are required');
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

export function getR2Client() {
  return client();
}

export const EVIDENCE_BUCKET = () => process.env.R2_BUCKET_EVIDENCE ?? 'splash-evidence';
export const RECEIPTS_BUCKET = () => process.env.R2_BUCKET_RECEIPTS ?? 'splash-receipts';

export async function presignUpload(args: {
  bucket: string;
  key: string;
  mimeType: string;
  contentLength: number;
  expiresIn?: number;
}) {
  const cmd = new PutObjectCommand({
    Bucket: args.bucket,
    Key: args.key,
    ContentType: args.mimeType,
    ContentLength: args.contentLength,
  });
  const url = await getSignedUrl(client(), cmd, { expiresIn: args.expiresIn ?? 300 });
  return { url, headers: { 'Content-Type': args.mimeType } };
}

export async function presignRead(args: { bucket: string; key: string; expiresIn?: number }) {
  const cmd = new GetObjectCommand({ Bucket: args.bucket, Key: args.key });
  return getSignedUrl(client(), cmd, { expiresIn: args.expiresIn ?? 300 });
}

export async function deleteObject(args: { bucket: string; key: string }) {
  const cmd = new DeleteObjectCommand({ Bucket: args.bucket, Key: args.key });
  await client().send(cmd);
}

/** Convención: {businessId}/appointments/{appointmentId}/{phase}/{uuid}.{ext} */
export function evidenceKey(args: {
  businessId: string;
  appointmentId: string;
  phase: string;
  photoId: string;
  ext: string;
}) {
  return `${args.businessId}/appointments/${args.appointmentId}/${args.phase}/${args.photoId}.${args.ext}`;
}

export function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/heic':
      return 'heic';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}
