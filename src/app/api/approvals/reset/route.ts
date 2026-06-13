import { auth } from "@clerk/nextjs/server";

import { clearUserApprovalState, getLatestRadarSnapshot, saveRadarSnapshot } from "@/lib/db";
import { getRadarSnapshot } from "@/lib/demo-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Reset every approval in the persisted snapshot back to "pending" and clear
 * the calling user's per-user approval decisions (and dismissals) so the
 * queue re-prompts them on the next render. Requires a signed-in Clerk
 * session (enforced by the proxy matcher in src/proxy.ts).
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const current = (await getLatestRadarSnapshot()) ?? getRadarSnapshot();
  const resetSnapshot = {
    ...current,
    approvals: current.approvals.map((approval) => ({ ...approval, status: "pending" as const })),
  };

  await saveRadarSnapshot(resetSnapshot, "manual");
  await clearUserApprovalState(userId);

  return Response.json({
    ok: true,
    resetAt: new Date().toISOString(),
    pendingCount: resetSnapshot.approvals.length,
    snapshot: resetSnapshot,
  });
}
