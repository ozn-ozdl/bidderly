// Small HTTP fetcher for the scraper module.
//
// - Per-host rate limit (token bucket) so the demo can't accidentally
//   hammer a real portal.
// - 10s timeout, 200KB cap.
// - Redirect cap to avoid loops.
// - No external dependencies.

import { envFlag } from "@/lib/env";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 200 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_QPS = 2;

export type FetchPageOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

export type FetchedPage = {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  contentType: string;
  bytes: number;
  html: string;
  durationMs: number;
};

// --- Rate limit state (per host) -----------------------------------------

type Bucket = { tokens: number; lastRefill: number };
const buckets = new Map<string, Bucket>();

function takeToken(host: string, qps: number): boolean {
  const now = Date.now();
  const b = buckets.get(host) ?? { tokens: qps, lastRefill: now };
  const elapsedSec = (now - b.lastRefill) / 1000;
  const refill = elapsedSec * qps;
  const tokens = Math.min(qps, b.tokens + refill);
  if (tokens < 1) {
    buckets.set(host, { tokens, lastRefill: now });
    return false;
  }
  buckets.set(host, { tokens: tokens - 1, lastRefill: now });
  return true;
}

function getHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error("aborted");
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function fetchPage(
  url: string,
  opts: FetchPageOptions = {},
): Promise<FetchedPage> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  const host = getHost(url);
  const qps = Number(process.env.SCRAPER_QPS ?? DEFAULT_QPS);
  if (!takeToken(host, qps)) {
    // Back off 250ms and try once more.
    await sleep(250, opts.signal);
    if (!takeToken(host, qps)) {
      throw new Error(`rate_limited:${host}`);
    }
  }

  const start = Date.now();
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    opts.signal.addEventListener("abort", onParentAbort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = url;
    let redirects = 0;
    let response: Response | undefined;

    while (true) {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "BidderlyBot/1.0 (+hackathon demo)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get("location")
      ) {
        const next = new URL(response.headers.get("location")!, currentUrl).toString();
        redirects += 1;
        if (redirects > maxRedirects) {
          throw new Error("too_many_redirects");
        }
        currentUrl = next;
        continue;
      }
      break;
    }

    if (!response) throw new Error("no_response");
    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "text/html";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(`unsupported_content_type:${contentType}`);
    }

    // Read with a byte cap to avoid blowing up on huge pages.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("no_body");

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Error("payload_too_large");
      }
      chunks.push(value);
    }

    const html = new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return {
      url,
      finalUrl: currentUrl,
      status: response.status,
      ok: true,
      contentType,
      bytes: received,
      html,
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
    if (opts.signal) opts.signal.removeEventListener("abort", onParentAbort);
  }
}

export function isScraperEnabled(): boolean {
  return envFlag("SCRAPER_ENABLED", true);
}
