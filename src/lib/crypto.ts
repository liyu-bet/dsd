import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("DATA_ENCRYPTION_KEY is not set");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export async function encryptSecret(value: string): Promise<string> {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export async function decryptSecret(payload: string | null | undefined): Promise<string | null> {
  if (!payload) return null;

  const parts = payload.split(":");
  if (parts.length !== 3) {
    return payload;
  }

  try {
    const [ivB64, authTagB64, encryptedB64] = parts;

    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const encrypted = Buffer.from(encryptedB64, "base64");

    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export function hasStoredSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}