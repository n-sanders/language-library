import { createDecipheriv, createHash } from "node:crypto";

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set.");
  return createHash("sha256").update(secret).digest();
}

/** Decrypts a legacy AES-256-GCM payload: base64 of iv(12) + tag(16) + ciphertext. */
export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
