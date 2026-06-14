// POST /api/scout-scrape
//
// Runs the scraper against the configured mock-tenders hosts (and any
// allow-listed public portals), returns the parsed pages without
// pushing them through the cascade. The cascade-incorporated version
// is the existing /api/scout-run.

import { scrapeTenderPages } from "@/lib/scraper";
import { isPioneerDryRun } from "@/lib/pioneer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MOCK_BASE = process.env.MOCK_TENDER_BASE_URL ?? "http://localhost:3000/mock-tenders";

const MOCK_PAGES = [
  "munich-it.html",
  "berlin-solar.html",
  "hamburg-supplier-day.html",
  "eu-digital-services.html",
  "cologne-duplicate.html",
  "network-breakfast.html",
  "stuttgart-energy.html",
  "bremen-expired.html",
];

export async function POST() {
  const sources = MOCK_PAGES.map((file) => ({
    id: `src_mock_${file.replace(".html", "")}`,
    name: `Mock tender — ${file}`,
    type: "public_tender_portal" as const,
    url: `${MOCK_BASE}/${file}`,
    geography: "Germany / EU",
  }));

  const result = await scrapeTenderPages(sources, { concurrency: 4 });

  return Response.json({
    scraper: {
      pages: result.pages.length,
      failures: result.failures.length,
    },
    pioneerDryRun: isPioneerDryRun(),
    pages: result.pages.map((p) => ({
      url: p.url,
      finalUrl: p.finalUrl,
      status: p.status,
      bytes: p.bytes,
      durationMs: p.durationMs,
      detectedLanguage: p.detectedLanguage,
      tenderId: p.tenderId,
      title: p.title,
      rawText: p.rawText,
    })),
    failures: result.failures,
  });
}
