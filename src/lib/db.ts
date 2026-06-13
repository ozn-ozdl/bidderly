import { Pool, type QueryResultRow } from "pg";

import type { RadarSnapshot } from "./radar-types";

let pool: Pool | null = null;
let ensured = false;

function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
  }

  return pool;
}

async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  const db = getPool();

  if (!db) {
    return null;
  }

  try {
    return await db.query<T>(text, values);
  } catch (error) {
    console.warn("[db] query failed; falling back to fixture data", error);
    return null;
  }
}

export async function ensureSnapshotTable() {
  if (ensured || process.env.DB_AUTO_INIT === "false") {
    return;
  }

  await query(`
    create table if not exists radar_snapshots (
      id text primary key,
      source text not null,
      snapshot jsonb not null,
      created_at timestamptz not null default now()
    );
  `);
  ensured = true;
}

export async function saveRadarSnapshot(
  snapshot: RadarSnapshot,
  source: "fixture" | "live" | "cron" | "manual" = "manual",
) {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  await ensureSnapshotTable();
  const result = await query(
    `
      insert into radar_snapshots (id, source, snapshot)
      values ($1, $2, $3::jsonb)
      on conflict (id) do update
        set source = excluded.source,
            snapshot = excluded.snapshot,
            created_at = now()
    `,
    ["latest", source, JSON.stringify(snapshot)],
  );

  return Boolean(result);
}

export async function getLatestRadarSnapshot() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  await ensureSnapshotTable();
  const result = await query<{ snapshot: RadarSnapshot }>(
    "select snapshot from radar_snapshots where id = $1 limit 1",
    ["latest"],
  );

  return result?.rows[0]?.snapshot ?? null;
}

/**
 * Drop the per-user approval decisions and "dismissed" markers so the user is
 * re-prompted on the next realtime snapshot. Safe to call when the user has
 * never written any rows — the DELETE just affects 0 rows.
 */
export async function clearUserApprovalState(userId: string) {
  if (!process.env.DATABASE_URL || !userId) {
    return false;
  }

  await ensureUserStateTable();
  const approvals = await query("delete from user_approvals where user_id = $1", [userId]);
  const dismissals = await query("delete from user_dismissals where user_id = $1", [userId]);
  return Boolean(approvals || dismissals);
}

let userStateEnsured = false;
async function ensureUserStateTable() {
  if (userStateEnsured || process.env.DB_AUTO_INIT === "false") {
    return;
  }

  await query(`
    create table if not exists user_approvals (
      user_id text not null,
      finding_id text not null,
      status text not null check (status in ('pending','approved','needs_info')),
      note text,
      updated_at timestamptz not null default now(),
      primary key (user_id, finding_id)
    );
  `);
  await query(`
    create table if not exists user_dismissals (
      user_id text not null,
      finding_id text not null,
      dismissed_at timestamptz not null default now(),
      primary key (user_id, finding_id)
    );
  `);
  userStateEnsured = true;
}
