import { auth } from "@clerk/nextjs/server";

import { isClerkConfigured } from "@/lib/env";
import { getNegotiationDetail, NegotiationError } from "@/lib/negotiation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveUserId() {
  if (isClerkConfigured()) {
    const { userId } = await auth();
    if (userId) return userId;
  }
  return "demo@bidderly.win";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const detail = await getNegotiationDetail(id, await resolveUserId());
    return Response.json({ ok: true, detail });
  } catch (error) {
    if (error instanceof NegotiationError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[negotiations/detail] failed", error);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
