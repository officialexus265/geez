import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Simple but secure PIN hashing (for dual-approval withdrawals).
 * In production consider bcrypt/argon2 via a dedicated package.
 */
export function hashPin(pin: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(pin + usedSalt + (process.env.PIN_PEPPER || "geez-pepper"))
    .digest("hex");
  return { hash, salt: usedSalt };
}

export function verifyPin(pin: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPin(pin, salt);
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}
