# Bidderly.win

Bidderly.win is a proactive tender and procurement opportunity radar for sales teams. Scout agents watch German/EU procurement sources, announcement pages, and curated demo feeds, then push each finding through a cost-aware model cascade:

```text
fine-tuned Pioneer GLiNER2 -> Pioneer/Gemma 4 -> Gemini
```

The local app runs with deterministic demo fixtures so the full hackathon story works without provider keys. Production adapters plug into the same typed data model and route handlers.

## What Is Implemented

- Next.js App Router dashboard for the live radar feed.
- Typed data model for `Source`, `ScoutRun`, `Finding`, `Extraction`, `ModelScore`, `Opportunity`, `ApprovalRequest`, and agent events.
- Synthetic GLiNER training examples with entity spans and procurement clue labels.
- Route handlers:
  - `GET /api/radar` returns the full snapshot, cascade metadata, and training examples.
  - `POST /api/scout-run` simulates a manual scout run.
  - `GET /api/events` streams demo agent events over Server-Sent Events.
  - `GET|POST /api/cron/scout` runs the scout pipeline with optional bearer protection.
  - `GET /api/integrations` reports configured provider status.
- Interactive approval flow: low-score findings do not alert; `human_review` and blocker findings show a foreground approval alert.
- SwiftUI companion scaffold in `ios/BidderlyRadarDemo/` for native radar summary, approval inbox, and foreground alert behavior.

## Model Cascade

### 1. Fine-Tuned GLiNER2 Extraction

Input:

- Raw announcement text
- Source type
- Source URL
- Detected language

Output:

- Buyer/issuer
- Project name
- Category
- Location
- Deadline
- Budget/value
- Contact/persona
- Procurement clue tags: `budget_approved`, `supplier_call`, `pre_announcement`, `official_tender`, `deadline_near`, `login_required`, `event_notice`, `duplicate`, `expired`

Synthetic examples live in [src/lib/demo-data.ts](src/lib/demo-data.ts) as `syntheticTrainingExamples`. Each example includes text, language, source type, expected entity spans, clue labels, split, and example type.

### 2. Pioneer/Gemma 4 Scoring And Routing

Gemma 4 returns:

- `worthOutreachScore` from `0-100`
- `urgency`: `low`, `medium`, `high`
- `route`: `ignore`, `monitor`, `qualify`, `human_review`
- Short rationale

### 3. Gemini Deep Reasoning Gate

Gemini is called only when:

- `worthOutreachScore >= 70`
- or route is `human_review`
- or urgency is `high`
- or a blocker needs human judgment

The gate is implemented in [src/lib/cascade.ts](src/lib/cascade.ts), and `getRadarSnapshot()` validates that fixture Gemini analyses obey it.

## Agent Roles

- Research scout: finds raw public announcements through watchlisted pages, safe curated feeds, and Tavily enrichment.
- Extraction agent: runs fine-tuned GLiNER2 and writes structured entities plus clue tags.
- Scoring/routing agent: runs Gemma 4 and suppresses weak or irrelevant findings.
- Reasoning agent: uses Gemini only for high-value findings or blocker cases.
- Human escalation agent: creates approval requests only when user input is required.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful checks:

```bash
npm run lint
npm run build
```

The build may need a normal local environment because Turbopack can bind an internal local port during CSS processing.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in real values when connecting providers:

```bash
cp .env.example .env.local
```

Core variables:

- `DATABASE_URL`: Railway Postgres connection string.
- `DB_AUTO_INIT`: when `true`, creates the `radar_snapshots` cache table automatically.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`: Clerk web auth.
- `PIONEER_GLINER_ENDPOINT`, `PIONEER_GLINER_API_KEY`: fine-tuned GLiNER/GLiNER2 extraction.
- `PIONEER_GEMMA4_ENDPOINT`, `PIONEER_GEMMA4_API_KEY`: Gemma 4 scoring/routing.
- `GEMINI_API_KEY`: final reasoning.
- `GEMINI_MODEL`: defaults to `gemini-2.5-pro`.
- `TAVILY_API_KEY`: search and source enrichment.
- `TAVILY_PROJECT_ID`: optional Tavily project tracking header.
- `DEMO_USE_FIXTURES`: keep `true` for hackathon-safe deterministic mode; set `false` only when all live provider keys are configured.
- `SCOUT_CRON_SECRET`: protects scheduled scout triggers.

## Postgres

The production schema is in [docs/postgres-schema.sql](docs/postgres-schema.sql). The app now persists the latest full radar snapshot in Postgres when `DATABASE_URL` is set, and it also includes relational tables for the long-term source/run/finding/extraction/score/opportunity/approval/event model.

Recommended Railway setup:

1. Create a Railway project.
2. Add a Postgres service.
3. Add this Next.js app service from GitHub.
4. Set `DATABASE_URL` from Railway Postgres.
5. Add Clerk, Pioneer, Gemini, and Tavily variables.
6. Run the SQL in `docs/postgres-schema.sql` against the Railway database.
7. Deploy with the included [railway.json](railway.json).
8. Set `DEMO_USE_FIXTURES=false` only after Tavily, Pioneer GLiNER, Pioneer Gemma 4, and Gemini keys are present.

## Cloudflare DNS

For `bidderly.win`:

1. Add the domain to Cloudflare.
2. Add a `CNAME` record for `www` pointing to the Railway public domain.
3. Add an apex `CNAME` or Cloudflare CNAME flattening record pointing to Railway.
4. Enable proxied DNS after Railway has issued TLS.
5. Set `NEXT_PUBLIC_APP_URL=https://bidderly.win`.

## Clerk

The app has Clerk-ready routes at `/sign-in` and `/sign-up`, plus `src/proxy.ts` route protection. If Clerk keys are missing, the proxy stays open so demo hosting still works.

Production wiring:

1. Create a Clerk application.
2. Add `bidderly.win` and the Railway preview URL as allowed origins.
3. Set the Clerk environment variables.
4. The App Router layout will wrap content in `ClerkProvider` automatically when keys are present.
5. The proxy protects `/`, `/api/radar`, `/api/events`, and `/api/scout-run` when Clerk is configured.
6. Keep server-side auth checks for write routes as the app grows; do not rely on proxy alone for sensitive mutations.

iOS notes are in [docs/ios-companion.md](docs/ios-companion.md). The SwiftUI scaffold keeps sign-in mocked so it can be read without a configured Xcode project; replace that state with Clerk iOS session state in production.

## Partner Technology Adapters

The fixture flow maps directly to production calls:

1. Tavily search/enrichment finds source URLs and snippets.
2. Pioneer GLiNER2 receives `{ rawText, sourceType, sourceUrl, detectedLanguage }`.
3. Pioneer/Gemma 4 receives the extraction and returns score, urgency, route, and rationale.
4. Gemini receives only gated findings and returns summary, risks, next steps, and blockers.
5. Approval requests are emitted to `/api/events` for web and active iOS clients.

The live adapter code is in [src/lib/provider-clients.ts](src/lib/provider-clients.ts), and the orchestration code is in [src/lib/live-pipeline.ts](src/lib/live-pipeline.ts). With `DEMO_USE_FIXTURES=true`, the app never calls external providers. With `DEMO_USE_FIXTURES=false`, the scout route requires all live provider variables.

## Demo Script

1. Open `http://localhost:3000`.
2. Confirm the dashboard shows watched German/EU sources.
3. Click `Run scout`.
4. Point out six raw findings from portals, council pages, Tavily-style enrichment, and curated demo data.
5. Open the Munich or EU finding.
6. Show GLiNER2 extracted buyer, project, deadline, budget, and clue tags.
7. Show Gemma 4 score, urgency, route, and rationale.
8. Show low-score duplicate/irrelevant findings routed to `ignore` without an alert.
9. Show Gemini analysis only on high-value or human-review findings.
10. Show the foreground approval alert.
11. Click `Approve` or `Request info`.
12. Show the activity timeline and pending decisions updating locally.

## Verification Checklist

- Synthetic GLiNER examples include entity spans and clue labels.
- GLiNER extraction fixtures produce structured entities for every finding.
- Gemma scoring fixtures include score, urgency, route, and rationale.
- Gemini fixtures pass the cascade gate in `validateCascadeGate()`.
- Low-score findings route to `ignore` and do not create approval alerts.
- High-value findings become opportunities.
- Approval requests render on web and in the SwiftUI companion scaffold.
- Foreground alert appears only for pending approval requests.
- README documents model cascade, Pioneer usage, Railway setup, Cloudflare DNS, environment variables, partner tech, and demo script.

## Known Scope Boundaries

- The repository uses fixtures by default; real scraping is intentionally limited to safe watchlisted pages and Tavily-backed enrichment.
- Postgres persistence is represented by schema and adapter-ready types, not a live DB client.
- Clerk auth is documented and UI-ready, but local demo mode does not require Clerk keys.
- iOS locked-screen push is out of scope; foreground alert is the demo target.

## Project Files

- [src/components/radar-dashboard.tsx](src/components/radar-dashboard.tsx): interactive dashboard.
- [src/lib/demo-data.ts](src/lib/demo-data.ts): fixtures and synthetic training examples.
- [src/lib/cascade.ts](src/lib/cascade.ts): cascade gate and routing helpers.
- [docs/postgres-schema.sql](docs/postgres-schema.sql): production persistence schema.
- [ios/BidderlyRadarDemo](ios/BidderlyRadarDemo): SwiftUI companion scaffold.
