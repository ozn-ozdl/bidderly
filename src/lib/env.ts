export type IntegrationStatus = {
  mode: "fixture" | "live-ready" | "partial-live";
  clerk: boolean;
  database: boolean;
  tavily: boolean;
  pioneerGliner2: boolean;
  pioneerClues: boolean;
  pioneerScoring: boolean;
  pioneerDryRun: boolean;
  mockTenderBaseUrl: string | null;
  gemini: boolean;
  missing: string[];
};

const liveProviderKeys = [
  "TAVILY_API_KEY",
  "GEMINI_API_KEY",
] as const;

export function envFlag(name: string, defaultValue = false) {
  const value = process.env[name];

  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function isPioneerKeyConfigured() {
  return Boolean(process.env.PIONEER_API_KEY);
}

export function isPioneerDryRun() {
  return envFlag("PIONEER_DRY_RUN", true) || !isPioneerKeyConfigured();
}

export function getIntegrationStatus(): IntegrationStatus {
  const missing = liveProviderKeys.filter((key) => !process.env[key]);
  const liveReady = missing.length === 0;
  const forceFixtures = envFlag("DEMO_USE_FIXTURES", true);
  const pioneerDryRun = isPioneerDryRun();
  const pioneerGliner2 = isPioneerKeyConfigured() && Boolean(process.env.PIONEER_GLINER2_MODEL);
  const pioneerScoring = isPioneerKeyConfigured() && Boolean(process.env.PIONEER_GEMMA4_MODEL);

  return {
    mode: forceFixtures ? "fixture" : liveReady ? "live-ready" : "partial-live",
    clerk: isClerkConfigured(),
    database: isDatabaseConfigured(),
    tavily: Boolean(process.env.TAVILY_API_KEY),
    pioneerGliner2,
    pioneerClues: Boolean(process.env.PIONEER_CLUES_MODEL),
    pioneerScoring,
    pioneerDryRun,
    mockTenderBaseUrl: process.env.MOCK_TENDER_BASE_URL ?? null,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    missing: missing.slice(),
  };
}

export function shouldUseFixtureMode() {
  const status = getIntegrationStatus();

  return status.mode !== "live-ready";
}

export function isRealtimeConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_REALTIME_URL);
}

export function requireCronSecret(request: Request) {
  const expected = process.env.SCOUT_CRON_SECRET;

  if (!expected) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${expected}`;
}
