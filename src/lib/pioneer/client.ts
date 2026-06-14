// Fastino / Pioneer HTTP client.
//
// Two modes:
//   - Live  (PIONEER_DRY_RUN=false + PIONEER_API_KEY set): calls api.pioneer.ai.
//   - Dry   (default): the entire surface is short-circuited to canned
//           responses that match the real API shape, so every caller
//           exercises the same code path with no key dependency.
//
// The dry-run path is what powers the hackathon demo when no live key is
// available, and what we use while wiring up the integration so a missing
// key never bricks the cascade.

import { envFlag } from "@/lib/env";

export const PIONEER_BASE_URL = process.env.PIONEER_BASE_URL ?? "https://api.pioneer.ai";

export function getPioneerApiKey(): string {
  return process.env.PIONEER_API_KEY ?? "";
}

export const PIONEER_API_KEY = getPioneerApiKey();

export const isPioneerDryRun = (): boolean =>
  envFlag("PIONEER_DRY_RUN", true) || !getPioneerApiKey();

export const isPioneerConfigured = (): boolean => Boolean(getPioneerApiKey());

// --- Errors ----------------------------------------------------------------

export class PioneerError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "PioneerError";
  }
}

const STATUS_CODES: Record<number, { code: string; message: string }> = {
  401: { code: "unauthorized", message: "Missing or invalid Pioneer API key." },
  402: { code: "payment_required", message: "Pioneer plan out of credits." },
  404: { code: "not_found", message: "Resource not found in Pioneer." },
  422: { code: "unprocessable_entity", message: "Request payload rejected by Pioneer." },
  429: { code: "rate_limited", message: "Pioneer rate limit hit; retry shortly." },
  500: { code: "server_error", message: "Pioneer internal error; retry shortly." },
};

function httpError(status: number, bodyText: string): PioneerError {
  const known = STATUS_CODES[status];
  let details: unknown = bodyText;
  try {
    details = JSON.parse(bodyText);
  } catch {
    // leave details as raw text
  }
  return new PioneerError(
    status,
    known?.code ?? `http_${status}`,
    known?.message ?? `Pioneer returned HTTP ${status}.`,
    details,
  );
}

// --- Request helper --------------------------------------------------------

export type PioneerFetchInit = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the dry-run short-circuit even in dry mode. Used by /inference dry-run. */
  allowDryRun?: boolean;
};

export type PioneerFetchResult<T> = {
  ok: boolean;
  status: number;
  data: T;
};

export async function pioneerFetch<T = unknown>(
  path: string,
  init: PioneerFetchInit = {},
): Promise<PioneerFetchResult<T>> {
  const url = new URL(path.startsWith("http") ? path : `${PIONEER_BASE_URL}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  if (isPioneerDryRun() && !init.allowDryRun) {
    throw new PioneerError(
      503,
      "dry_run",
      `Pioneer dry-run is active; refusing live fetch of ${path}.`,
    );
  }

  const apiKey = getPioneerApiKey();
  if (!apiKey) {
    throw new PioneerError(401, "unauthorized", "PIONEER_API_KEY is not set.");
  }

  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };

  const response = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON body
  }

  if (!response.ok) {
    throw httpError(response.status, text);
  }

  return { ok: true, status: response.status, data: data as T };
}
