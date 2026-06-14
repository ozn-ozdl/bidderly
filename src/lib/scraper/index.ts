// Scraper entry point.
//
// scrapeTenderPages(sources) hits a list of `Source` URLs, parses each
// into raw text, follows internal links that look like tender detail
// pages, and returns a normalized list of RawPage objects the
// cascade can convert into Findings.
//
// Allow-list:
//   - localhost / 127.0.0.1 (the mock-tenders directory served by Next.js)
//   - The standalone mock-sites Railway service (hostname pulled from
//     MOCK_TENDER_BASE_URL)
//   - A short list of public procurement domains used in the demo
//
// Anything else is rejected so a misconfiguration can't accidentally
// crawl the live web.

import { fetchPage, isScraperEnabled } from "./fetch";
import { detectLanguageHeuristic, extractInternalLinks, parseTenderPage } from "./parse";
import type { Source } from "@/lib/radar-types";

export type RawPage = {
  url: string;
  finalUrl: string;
  status: number;
  bytes: number;
  durationMs: number;
  rawText: string;
  /**
   * The raw HTML body, kept around so the orchestrator can pull out
   * the listing-page link set before text cleaning destroyed the
   * tag boundaries. Used only by the follow-links stage.
   */
  html: string;
  tenderId: string | null;
  title: string | null;
  detectedLanguage: "de" | "en";
  publishedAt: string | null;
};

export type ScraperResult = {
  pages: RawPage[];
  failures: Array<{ url: string; reason: string }>;
};

export type ScraperOptions = {
  signal?: AbortSignal;
  concurrency?: number;
  /** Max number of links to follow from each home page. Default 12. */
  maxLinksPerPortal?: number;
  /** Stop following links once a page is known to be a detail page (heuristic). */
  followLinks?: boolean;
};

// --- Allow-list -----------------------------------------------------------

const ALLOWED_HOSTS = new Set<string>([
  // Demo / local
  "localhost:3000",
  "127.0.0.1:3000",
  "localhost:3002",
  "127.0.0.1:3002",
  // The standalone mock-sites Railway service that hosts 4 mock
  // tender portals (TED EU, Bund.de, stadt.muenchen.de, berlin.de
  // style layouts). The exact hostname is operator-configurable via
  // MOCK_TENDER_BASE_URL; we add any host that ends in a known
  // suffix here so a re-deploy doesn't need a code change.
  process.env.MOCK_TENDER_BASE_URL ? new URL(process.env.MOCK_TENDER_BASE_URL).host.toLowerCase() : "",
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
].filter((host) => host.length > 0));

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
  sources: Pick<Source, "id" | "url" | "name" | "type" | "geography">[],
  options: ScraperOptions = {},
): Promise<ScraperResult> {
  if (!isScraperEnabled()) {
    return { pages: [], failures: sources.map((s) => ({ url: s.url, reason: "scraper_disabled" })) };
  }

  const concurrency = options.concurrency ?? 4;
  const maxLinksPerPortal = options.maxLinksPerPortal ?? 12;
  const followLinks = options.followLinks ?? true;
  type QueueItem = { url: string; sourceId: string; sourceName: string; sourceType: string; geography: string };
  const queue: QueueItem[] = sources.map((s) => ({
    url: s.url,
    sourceId: s.id,
    sourceName: s.name,
    sourceType: s.type,
    geography: s.geography,
  }));
  const seen = new Set<string>();
  const pages: RawPage[] = [];
  const failures: ScraperResult["failures"] = [];

  const workers = Array.from({ length: concurrency }).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      try {
        const page = await scrapeOne(item);
        if (page) {
          pages.push(page);
          // If this was a portal home and the home has no tender-id
          // meta (it's a listing page), discover the detail links and
          // queue them too. We extract from the raw HTML because the
          // cleaned text has no <a> tags left.
          if (followLinks && !page.tenderId) {
            const detailLinks = extractInternalLinks(page.html, page.url)
              .filter((href) => href !== page.url)
              .filter((href) => !seen.has(href))
              .slice(0, maxLinksPerPortal);
            for (const href of detailLinks) {
              queue.push({
                url: href,
                sourceId: item.sourceId,
                sourceName: item.sourceName,
                sourceType: item.sourceType,
                geography: item.geography,
              });
            }
          }
        } else {
          failures.push({ url: item.url, reason: "no_text" });
        }
      } catch (err) {
        failures.push({ url: item.url, reason: err instanceof Error ? err.message : String(err) });
      }
    }
  });

  await Promise.all(workers);
  return { pages, failures };
}

async function scrapeOne(
  item: { url: string; sourceId: string; sourceName: string; sourceType: string; geography: string },
): Promise<RawPage | null> {
  if (!isAllowedHost(item.url)) {
    throw new Error("host_not_allowed");
  }
  const fetched = await fetchPage(item.url);
  const parsed = parseTenderPage(fetched.html);
  if (!parsed.rawText) return null;
  const detectedLanguage: "de" | "en" =
    parsed.detectedLanguage ?? detectLanguageHeuristic(parsed.rawText);
  return {
    url: item.url,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    bytes: fetched.bytes,
    durationMs: fetched.durationMs,
    rawText: parsed.rawText,
    html: fetched.html,
    tenderId: parsed.tenderId,
    title: parsed.title,
    detectedLanguage,
    publishedAt: null,
  };
}
