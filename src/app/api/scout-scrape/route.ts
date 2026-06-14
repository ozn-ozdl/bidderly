// POST /api/scout-scrape
//
// Runs the scraper against the configured mock-tender-portals hosts
// (the standalone mock-sites Railway service), returns the parsed
// pages without pushing them through the cascade. The cascade-
// incorporated version is the existing /api/scout-run.

import { scrapeTenderPages } from "@/lib/scraper";
import { isPioneerDryRun } from "@/lib/pioneer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MOCK_BASE = process.env.MOCK_TENDER_BASE_URL ?? "http://localhost:3002";

const MOCK_PORTALS = [
  { slug: "ted-eu", name: "TED EU" },
  { slug: "bund-de", name: "Bund.de" },
  { slug: "stadt-muenchen", name: "stadt.muenchen.de" },
  { slug: "berlin-de", name: "berlin.de" },
];

export async function POST() {
  const sources = MOCK_PORTALS.map((portal) => ({
    id: `src_mock_${portal.slug.replaceAll("-", "_")}`,
    name: `Mock portal — ${portal.name}`,
    type: "public_tender_portal" as const,
    url: `${MOCK_BASE}/${portal.slug}/`,
    geography: "Germany / EU",
  }));

  const result = await scrapeTenderPages(sources, {
    concurrency: 4,
    followLinks: true,
    maxLinksPerPortal: 8,
  });

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
      htmlBytes: p.html.length,
    })),
    failures: result.failures,
  });
}
