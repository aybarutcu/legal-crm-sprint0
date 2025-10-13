import { createHash, randomBytes } from "node:crypto";

const DEFAULT_SECRET = "client-invite-secret";

function getInviteSecret() {
  return (
    process.env.CLIENT_INVITE_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    DEFAULT_SECRET
  );
}

export function generateInviteToken() {
  const token = randomBytes(32).toString("base64url");
  const hash = hashInviteToken(token);
  return { token, hash };
}

export function hashInviteToken(token: string) {
  const secret = getInviteSecret();
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export function verifyInviteToken(token: string, hash: string) {
  if (!hash) return false;
  const calculated = hashInviteToken(token);
  return calculated === hash;
}
