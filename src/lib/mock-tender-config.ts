// Shared configuration for the mock tender portal Railway service.

export const MOCK_PORTAL_SLUGS = [
  "ted-eu",
  "bund-de",
  "stadt-muenchen",
  "berlin-de",
] as const;

export function mockTenderBaseUrl(): string {
  return process.env.MOCK_TENDER_BASE_URL ?? "http://localhost:3002";
}

export function envNonEmpty(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function isLocalMockHost(baseUrl = mockTenderBaseUrl()): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return true;
  }
}

export function mockPortalHomeUrls(baseUrl = mockTenderBaseUrl()): string[] {
  const root = baseUrl.replace(/\/$/, "");
  return MOCK_PORTAL_SLUGS.map((slug) => `${root}/${slug}/`);
}

export function mockTenderHostname(baseUrl = mockTenderBaseUrl()): string | null {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return null;
  }
}
