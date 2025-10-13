import { createHash, randomBytes } from "node:crypto";

const DEFAULT_SECRET = "client-reset-secret";

function getResetSecret() {
  return (
    process.env.CLIENT_RESET_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    DEFAULT_SECRET
  );
}

export function generateResetToken() {
  const token = randomBytes(32).toString("base64url");
  const hash = hashResetToken(token);
  return { token, hash };
}

export function hashResetToken(token: string) {
  const secret = getResetSecret();
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}
