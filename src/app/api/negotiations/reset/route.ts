import { auth } from "@clerk/nextjs/server";

import { isClerkConfigured } from "@/lib/env";
import { resetNegotiations } from "@/lib/negotiation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveUserId() {
  if (isClerkConfigured()) {
    const { userId } = await auth();
    if (userId) return userId;
  }
  return "demo@bidderly.win";
}

export async function POST() {
  const result = await resetNegotiations(await resolveUserId());
  return Response.json({ ok: true, ...result });
}
