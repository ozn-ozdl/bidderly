import { auth } from "@clerk/nextjs/server";

import { isClerkConfigured } from "@/lib/env";
import { listNegotiations } from "@/lib/negotiation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveUserId() {
  if (isClerkConfigured()) {
    const { userId } = await auth();
    if (userId) return userId;
  }
  return "demo@bidderly.win";
}

export async function GET() {
  const negotiations = await listNegotiations(await resolveUserId());
  return Response.json({ ok: true, negotiations });
}
