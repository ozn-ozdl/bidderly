import { verifyToken } from "@clerk/backend";

export type VerifiedUser = { sub: string; email?: string };

const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function verifyUser(token: string | undefined): Promise<VerifiedUser | null> {
  if (!token) return null;
  if (!process.env.CLERK_SECRET_KEY) return null;

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: authorizedParties.length ? authorizedParties : undefined,
    });
    if (!payload.sub) return null;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    return { sub: payload.sub, email };
  } catch {
    return null;
  }
}

export function roomFor(userId: string): string {
  return `user:${userId}`;
}
