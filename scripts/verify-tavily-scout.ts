#!/usr/bin/env npx tsx
/**
 * Quick scout verification:
 * 1. Assert Tavily scout config resolves correctly for the current env.
 * 2. Optionally hit Tavily when TAVILY_API_KEY is set.
 * 3. Scrape mock portal pages when mock-sites is reachable.
 */

import "dotenv/config";

import { mockPortalHomeUrls, mockTenderBaseUrl } from "../src/lib/mock-tender-config";
import { buildTavilyScoutRequest } from "../src/lib/tavily-scout";
import { searchTenderSignals } from "../src/lib/provider-clients";
import { scrapeTenderPages } from "../src/lib/scraper";

async function main() {
  const scout = buildTavilyScoutRequest();
  console.log("Tavily scout config:");
  console.log(JSON.stringify(scout, null, 2));

  const sources = mockPortalHomeUrls().map((url, index) => ({
    id: `src_mock_${index}`,
    name: `Mock portal ${index + 1}`,
    type: "public_tender_portal" as const,
    url,
    geography: "Germany / EU",
  }));

  const scrape = await scrapeTenderPages(sources, {
    followLinks: true,
    maxLinksPerPortal: 4,
  });
  console.log(
    `\nScraper: ${scrape.pages.length} pages, ${scrape.failures.length} failures (base=${mockTenderBaseUrl()})`,
  );
  if (scrape.failures.length > 0) {
    console.log("Scraper failures:", scrape.failures.slice(0, 3));
  }

  if (!process.env.TAVILY_API_KEY?.trim()) {
    console.log("\nTAVILY_API_KEY not set — skipping live Tavily call.");
    console.log("Set TAVILY_API_KEY and DEMO_USE_FIXTURES=false to run the full scout pipeline.");
    return;
  }

  const findings = await searchTenderSignals();
  console.log(`\nTavily findings: ${findings.length}`);
  for (const finding of findings.slice(0, 5)) {
    console.log(`- ${finding.title} (${finding.url})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
