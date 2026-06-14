// Scraper entry point.
//
// scrapeTenderPages(sources) hits a list of `Source` URLs, parses each
// into raw text, and returns a normalized list of RawPage objects the
// cascade can convert into Findings.
//
// Allow-list:
//   - localhost / 127.0.0.1 (the mock-tenders directory served by Next.js)
//   - A short list of public procurement domains used in the demo
//
// Anything else is rejected so a misconfiguration can't accidentally
// crawl the live web.

import { fetchPage, isScraperEnabled } from "./fetch";
import { detectLanguageHeuristic, parseTenderPage } from "./parse";
import type { Source } from "@/lib/radar-types";

export type RawPage = {
  url: string;
  finalUrl: string;
  status: number;
  bytes: number;
  durationMs: number;
  rawText: string;
  tenderId: string | null;
  title: string | null;
  detectedLanguage: "de" | "en";
  publishedAt: string | null;
};

export type ScraperResult = {
  pages: RawPage[];
  failures: Array<{ url: string; reason: string }>;
};

// --- Allow-list -----------------------------------------------------------

const ALLOWED_HOSTS = new Set<string>([
  // Demo / local
  "localhost:3000",
  "127.0.0.1:3000",
  // Public procurement portals we reference in the demo
  "stadt.muenchen.de",
  "www.muenchen.de",
  "service.bund.de",
  "www.service.bund.de",
  "berlin.de",
  "www.berlin.de",
  "ted.europa.eu",
  "www.ted.europa.eu",
  "evergabe-online.de",
  "www.evergabe-online.de",
]);

const ALLOW_ALL = process.env.SCRAPER_ALLOW_ALL === "true";

function isAllowedHost(url: string): boolean {
  if (ALLOW_ALL) return true;
  try {
    const host = new URL(url).host.toLowerCase();
    return ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}

// --- Public API ------------------------------------------------------------

export async function scrapeTenderPages(
  sources: Pick<Source, "id" | "url" | "name" | "geography">[],
  options?: { signal?: AbortSignal; concurrency?: number },
): Promise<ScraperResult> {
  if (!isScraperEnabled()) {
    return { pages: [], failures: sources.map((s) => ({ url: s.url, reason: "scraper_disabled" })) };
  }

  const concurrency = options?.concurrency ?? 4;
  const queue = sources.slice();
  const pages: RawPage[] = [];
  const failures: ScraperResult["failures"] = [];

  const workers = Array.from({ length: concurrency }).map(async () => {
    while (queue.length > 0) {
      const source = queue.shift();
      if (!source) break;
      try {
        const page = await scrapeOne(source);
        if (page) pages.push(page);
        else failures.push({ url: source.url, reason: "no_text" });
      } catch (err) {
        failures.push({ url: source.url, reason: err instanceof Error ? err.message : String(err) });
      }
    }
  });

  await Promise.all(workers);
  return { pages, failures };
}

async function scrapeOne(
  source: Pick<Source, "id" | "url" | "name" | "geography">,
): Promise<RawPage | null> {
  if (!isAllowedHost(source.url)) {
    throw new Error("host_not_allowed");
  }
  const fetched = await fetchPage(source.url);
  const parsed = parseTenderPage(fetched.html);
  if (!parsed.rawText) return null;
  const detectedLanguage: "de" | "en" =
    parsed.detectedLanguage ?? detectLanguageHeuristic(parsed.rawText);
  return {
    url: source.url,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    bytes: fetched.bytes,
    durationMs: fetched.durationMs,
    rawText: parsed.rawText,
    tenderId: parsed.tenderId,
    title: parsed.title,
    detectedLanguage,
    publishedAt: null,
  };
}
