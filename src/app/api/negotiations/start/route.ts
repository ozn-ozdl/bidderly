import { auth } from "@clerk/nextjs/server";

import { isClerkConfigured } from "@/lib/env";
import { NegotiationError, startNegotiation } from "@/lib/negotiation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveUserId() {
  if (isClerkConfigured()) {
    const { userId } = await auth();
    if (userId) return userId;
  }
  return "demo@bidderly.win";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { approvalId?: string };
  if (!body.approvalId) {
    return Response.json({ ok: false, error: "approvalId required" }, { status: 400 });
  }
  try {
    const detail = await startNegotiation(body.approvalId, await resolveUserId());
    return Response.json({ ok: true, detail });
  } catch (error) {
    if (error instanceof NegotiationError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[negotiations/start] failed", error);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
