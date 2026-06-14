import { auth } from "@clerk/nextjs/server";

import { isClerkConfigured } from "@/lib/env";
import { NegotiationError, respondToCounterparty } from "@/lib/negotiation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveUserId() {
  if (isClerkConfigured()) {
    const { userId } = await auth();
    if (userId) return userId;
  }
  return "demo@bidderly.win";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    optionId?: string;
    adjustedParameters?: Record<string, string>;
  };
  if (!body.optionId) {
    return Response.json({ ok: false, error: "optionId required" }, { status: 400 });
  }
  try {
    const detail = await respondToCounterparty(
      id,
      body.optionId,
      body.adjustedParameters ?? {},
      await resolveUserId(),
    );
    return Response.json({ ok: true, detail });
  } catch (error) {
    if (error instanceof NegotiationError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[negotiations/respond] failed", error);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
