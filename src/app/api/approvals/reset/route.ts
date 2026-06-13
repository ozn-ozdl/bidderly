import { saveRadarSnapshot, getLatestRadarSnapshot } from "@/lib/db";
import { getRadarSnapshot } from "@/lib/demo-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Reset every approval in the persisted snapshot back to "pending".
 *
 * Mutates the stored `radar_snapshots` row so the next /api/radar read and the
 * next page load on the website both see a clean queue. If the DB is empty
 * (no snapshot ever saved) we fall back to the fixture snapshot, reset it,
 * and persist it so the reset sticks.
 */
export async function POST() {
  const current = (await getLatestRadarSnapshot()) ?? getRadarSnapshot();

  const resetSnapshot = {
    ...current,
    approvals: current.approvals.map((approval) => ({ ...approval, status: "pending" as const })),
  };

  await saveRadarSnapshot(resetSnapshot, "manual");

  return Response.json({
    ok: true,
    resetAt: new Date().toISOString(),
    pendingCount: resetSnapshot.approvals.length,
    snapshot: resetSnapshot,
  });
}
