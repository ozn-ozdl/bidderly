import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { query } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    // No DB configured — service runs in no-op mode (state events are ignored).
    return;
  }

  await query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const migrationsDir = join(__dirname, "..", "migrations");
  let files: string[];
  try {
    files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    return;
  }

  const appliedRows = await query<{ filename: string }>(
    "select filename from schema_migrations",
  );
  const applied = new Set(appliedRows?.map((r) => r.filename) ?? []);

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(migrationsDir, file), "utf8");
    await query(sql);
    await query("insert into schema_migrations (filename) values ($1)", [file]);
    console.log(`[migrate] applied ${file}`);
  }
}
