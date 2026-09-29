import { hashSync, verifySync } from "@node-rs/argon2";

export function hashPassword(password: string): string {
  return hashSync(password);
}

export function verifyPassword(hash: string, password: string): boolean {
  try {
    return verifySync(hash, password);
  } catch {
    return false;
  }
}

export const MIN_PASSWORD_LENGTH = 4;
