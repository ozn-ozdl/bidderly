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

  return db.query<T>(text, values);
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
  await query(
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

  return true;
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
