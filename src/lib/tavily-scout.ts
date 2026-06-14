import {
  envNonEmpty,
  isLocalMockHost,
  mockPortalHomeUrls,
  mockTenderBaseUrl,
  mockTenderHostname,
} from "@/lib/mock-tender-config";

export const DEFAULT_TAVILY_SCOUT_QUERY =
  "tender OR beschaffung OR vergabe OR ausschreibung OR procurement";

export type TavilyScoutRequest = {
  query: string;
  includeDomains?: string[];
  baseUrl: string;
  isLocal: boolean;
  discoveryUrls: string[];
};

export function buildTavilyScoutRequest(): TavilyScoutRequest {
  const baseUrl = mockTenderBaseUrl();
  const query = envNonEmpty("TAVILY_SCOUT_QUERY") ?? DEFAULT_TAVILY_SCOUT_QUERY;
  const isLocal = isLocalMockHost(baseUrl);
  const hostname = mockTenderHostname(baseUrl);

  return {
    query,
    includeDomains: !isLocal && hostname ? [hostname] : undefined,
    baseUrl,
    isLocal,
    discoveryUrls: mockPortalHomeUrls(baseUrl),
  };
}
