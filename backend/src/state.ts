import { z } from "zod";

import { query, queryOne } from "./db.js";

// Per-user state shapes. The `status` enum matches `ApprovalRequest.status`
// in the Next.js app's `src/lib/radar-types.ts`.
const approvalStatus = z.enum(["pending", "approved", "needs_info"]);

export const ApprovalSetSchema = z.object({
  findingId: z.string().min(1),
  status: approvalStatus,
  note: z.string().optional(),
});
export type ApprovalSet = z.infer<typeof ApprovalSetSchema>;

export const FindingIdSchema = z.object({ findingId: z.string().min(1) });
export const DismissalSetSchema = z.object({
  findingId: z.string().min(1),
  dismissed: z.boolean().default(true),
});

export type UserState = {
  approvals: Array<{ findingId: string; status: string; note: string | null; updatedAt: string }>;
  watchlist: Array<{ findingId: string; addedAt: string }>;
  dismissals: Array<{ findingId: string; dismissedAt: string }>;
  read: Array<{ findingId: string; readAt: string }>;
};

export async function loadUserState(userId: string): Promise<UserState> {
  const [approvals, watchlist, dismissals, read] = await Promise.all([
    query<{ finding_id: string; status: string; note: string | null; updated_at: string }>(
      "select finding_id, status, note, updated_at from user_approvals where user_id = $1",
      [userId],
    ),
    query<{ finding_id: string; added_at: string }>(
      "select finding_id, added_at from user_watchlist where user_id = $1",
      [userId],
    ),
    query<{ finding_id: string; dismissed_at: string }>(
      "select finding_id, dismissed_at from user_dismissals where user_id = $1",
      [userId],
    ),
    query<{ finding_id: string; read_at: string }>(
      "select finding_id, read_at from user_read_state where user_id = $1",
      [userId],
    ),
  ]);

  return {
    approvals:
      approvals?.map((r) => ({
        findingId: r.finding_id,
        status: r.status,
        note: r.note,
        updatedAt: asIso(r.updated_at),
      })) ?? [],
    watchlist:
      watchlist?.map((r) => ({ findingId: r.finding_id, addedAt: asIso(r.added_at) })) ?? [],
    dismissals:
      dismissals?.map((r) => ({ findingId: r.finding_id, dismissedAt: asIso(r.dismissed_at) })) ?? [],
    read: read?.map((r) => ({ findingId: r.finding_id, readAt: asIso(r.read_at) })) ?? [],
  };
}

export type StatePatch =
  | { kind: "approval"; findingId: string; status: string; note: string | null; updatedAt: string }
  | { kind: "watchlist"; findingId: string; added: boolean; at: string }
  | { kind: "dismissal"; findingId: string; dismissed: boolean; at: string }
  | { kind: "read"; findingId: string; at: string }
  | { kind: "reset" };

export async function setApproval(
  userId: string,
  input: unknown,
): Promise<StatePatch | null> {
  const parsed = ApprovalSetSchema.parse(input);
  await ensureUser(userId);
  const row = await queryOne<{ updated_at: string }>(
    `
      insert into user_approvals (user_id, finding_id, status, note, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (user_id, finding_id) do update
        set status = excluded.status,
            note = excluded.note,
            updated_at = now()
      returning updated_at
    `,
    [userId, parsed.findingId, parsed.status, parsed.note ?? null],
  );
  if (!row) return null;
  return {
    kind: "approval",
    findingId: parsed.findingId,
    status: parsed.status,
    note: parsed.note ?? null,
    updatedAt: asIso(row.updated_at),
  };
}

export async function toggleWatch(
  userId: string,
  input: unknown,
  add: boolean,
): Promise<StatePatch | null> {
  const { findingId } = parseFindingId(input);
  await ensureUser(userId);
  if (add) {
    const row = await queryOne<{ added_at: string }>(
      `
        insert into user_watchlist (user_id, finding_id, added_at)
        values ($1, $2, now())
        on conflict (user_id, finding_id) do update set added_at = user_watchlist.added_at
        returning added_at
      `,
      [userId, findingId],
    );
    if (!row) return null;
    return { kind: "watchlist", findingId, added: true, at: asIso(row.added_at) };
  }
  await query("delete from user_watchlist where user_id = $1 and finding_id = $2", [
    userId,
    findingId,
  ]);
  return { kind: "watchlist", findingId, added: false, at: new Date().toISOString() };
}

export async function setDismissed(
  userId: string,
  input: unknown,
): Promise<StatePatch | null> {
  const { findingId, dismissed } = DismissalSetSchema.parse(input);
  await ensureUser(userId);
  if (dismissed) {
    const row = await queryOne<{ dismissed_at: string }>(
      `
        insert into user_dismissals (user_id, finding_id, dismissed_at)
        values ($1, $2, now())
        on conflict (user_id, finding_id) do update set dismissed_at = user_dismissals.dismissed_at
        returning dismissed_at
      `,
      [userId, findingId],
    );
    if (!row) return null;
    return { kind: "dismissal", findingId, dismissed: true, at: asIso(row.dismissed_at) };
  }
  await query("delete from user_dismissals where user_id = $1 and finding_id = $2", [
    userId,
    findingId,
  ]);
  return { kind: "dismissal", findingId, dismissed: false, at: new Date().toISOString() };
}

export async function markRead(userId: string, input: unknown): Promise<StatePatch | null> {
  const { findingId } = parseFindingId(input);
  await ensureUser(userId);
  const row = await queryOne<{ read_at: string }>(
    `
      insert into user_read_state (user_id, finding_id, read_at)
      values ($1, $2, now())
      on conflict (user_id, finding_id) do update set read_at = now()
      returning read_at
    `,
    [userId, findingId],
  );
  if (!row) return null;
  return { kind: "read", findingId, at: asIso(row.read_at) };
}

async function ensureUser(userId: string): Promise<void> {
  await query(
    `
      insert into users (id, updated_at)
      values ($1, now())
      on conflict (id) do nothing
    `,
    [userId],
  );
}

function parseFindingId(input: unknown): { findingId: string } {
  return FindingIdSchema.parse(typeof input === "string" ? { findingId: input } : input);
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
