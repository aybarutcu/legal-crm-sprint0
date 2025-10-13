import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, SCRYPT_KEYLEN, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) return false;
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, salt);
  if (derived.length !== expectedHash.length) {
    return false;
  }
  return timingSafeEqual(derived, expectedHash);
}
