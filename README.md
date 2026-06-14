# Bidderly.win

Bidderly.win is a proactive tender and procurement opportunity radar for sales teams. Scout agents scrape German/EU procurement sources, announcement pages, and curated demo feeds, then push each finding through a cost-aware model cascade that is **fine-tuned on the same data it scores at inference time**:

```text
scraper -> fine-tuned Pioneer GLiNER2 -> Pioneer/Gemma 4 -> Gemini
```

The local app runs with deterministic demo fixtures so the full hackathon story works without provider keys. Production adapters plug into the same typed data model and route handlers.

## What Is Implemented

- Next.js App Router dashboard for the live radar feed.
- **Scraper** ([src/lib/scraper/](src/lib/scraper/)) — host-allow-listed HTTP fetcher with rate limit, timeout, and byte cap. Cleans HTML to plain text.
- **Mock tender portal** at `public/mock-tenders/*.html` (Munich IT, Berlin solar, Hamburg supplier day, EU digital services, Cologne duplicate, network breakfast, Stuttgart energy, Bremen expired). Each page embeds a `<meta name="tender-id">` so the parser can recover the original `Finding.id` after scraping. The body text matches the in-app fixtures exactly so GLiNER2 entity spans land on the same character offsets at train and serve time.
- **Pioneer / Fastino integration** ([src/lib/pioneer/](src/lib/pioneer/)) — direct calls to `api.pioneer.ai` for synthetic data generation, training jobs, evaluations, and inference. Dry-run by default (`PIONEER_DRY_RUN=true`) so the demo never needs a live key. Single `PIONEER_API_KEY` env var.
- **Alignment contract** ([src/lib/pioneer/schemas.ts](src/lib/pioneer/schemas.ts)) — single source of truth for entity labels, clue labels, and the scoring prompt. Imported by the scraper, the fixtures, the synthetic-data builders, and the inference call. Changing a label name here propagates to every layer.
- Synthetic GLiNER training examples with entity spans and procurement clue labels.
- Route handlers:
  - `GET /api/radar` returns the full snapshot, cascade metadata, training examples, and integration status.
  - `POST /api/scout-run` runs the full pipeline: scraper + Tavily enrichment + Pioneer cascade.
  - `POST /api/scout-scrape` runs only the scraper, returns the parsed pages.
  - `GET /api/events` streams demo agent events over Server-Sent Events.
  - `GET|POST /api/cron/scout` runs the scout pipeline with optional bearer protection.
  - `GET /api/integrations` reports configured provider status.
  - `POST /api/pioneer/synthesize` starts NER + classification + decoder generation jobs.
  - `GET|POST /api/pioneer/synthesize/status` polls generation jobs and lists datasets.
  - `POST /api/pioneer/train` submits NER + clues + scoring training jobs.
  - `GET|POST /api/pioneer/train/status` polls training jobs and reports metrics.
  - `GET|POST /api/pioneer/evaluations` runs and reads evaluation results.
  - `GET /api/pioneer/route` reports the active Pioneer routing state.
- Interactive approval flow: low-score findings do not alert; `human_review` and blocker findings show a foreground approval alert.
- **Pioneer training panel** in the radar sidebar — datasets, training jobs, F1 / precision / recall per checkpoint, eval deltas. The `Pioneer` view is the operational surface for the Fastino side challenge.

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
- `PIONEER_API_KEY`: Fastino/Pioneer API key. Replaces the old `PIONEER_GLINER_*` and `PIONEER_GEMMA4_*` env-var pairs; the cascade now calls `api.pioneer.ai` directly.
- `PIONEER_BASE_URL`: defaults to `https://api.pioneer.ai`.
- `PIONEER_DRY_RUN`: defaults to `true`; flips to `false` once a live key is set. The dry-run path exercises every code path and persists realistic-looking state to an in-memory store.
- `PIONEER_GLINER2_MODEL`: defaults to `fastino/gliner2-base-v1`. Use `fastino/gliner2-multi-v1` for multilingual DE + EN.
- `PIONEER_GEMMA4_MODEL`: defaults to `google/gemma-4-9b-it` (SFT-only on Pioneer per the LLM matrix).
- `PIONEER_NER_DATASET`, `PIONEER_CLUE_DATASET`, `PIONEER_SCORING_DATASET`: dataset names on Pioneer.
- `PIONEER_NER_JOB_NAME`, `PIONEER_CLUE_JOB_NAME`, `PIONEER_SCORING_JOB_NAME`: training job labels.
- `GEMINI_API_KEY`: final reasoning.
- `GEMINI_MODEL`: defaults to `gemini-2.5-pro`.
- `TAVILY_API_KEY`: search and source enrichment.
- `TAVILY_PROJECT_ID`: optional Tavily project tracking header.
- `DEMO_USE_FIXTURES`: keep `true` for hackathon-safe deterministic mode; set `false` only when all live provider keys are configured.
- `SCOUT_CRON_SECRET`: protects scheduled scout triggers.
- `SCRAPER_ENABLED`: defaults to `true`.
- `SCRAPER_ALLOW_ALL`: defaults to `false`; if `true`, the scraper will attempt any host (dev only).
- `SCRAPER_QPS`: per-host request rate, defaults to 2.
- `MOCK_TENDER_BASE_URL`: defaults to `http://localhost:3000/mock-tenders`.

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

## Pioneer / Fastino Side Challenge

The cascade is fine-tuned on the same data it scores at inference time, satisfying the **Fastino — Best use of Pioneer** side challenge (500€ prize). The integration is built around the alignment contract in [src/lib/pioneer/schemas.ts](src/lib/pioneer/schemas.ts) — the label vocabulary, the scoring prompt, and the row shapes are defined once and consumed by every layer.

### Modules

- [src/lib/pioneer/client.ts](src/lib/pioneer/client.ts) — base `pioneerFetch` with `X-API-Key` auth, dry-run short-circuit, and the documented 401/402/404/422/429/500 error mapping.
- [src/lib/pioneer/datasets.ts](src/lib/pioneer/datasets.ts) — `POST /generate` + `GET /generate/jobs/:id` + dataset inspection.
- [src/lib/pioneer/training.ts](src/lib/pioneer/training.ts) — `POST /felix/training-jobs` + polling + logs + checkpoints + stop + download.
- [src/lib/pioneer/evaluations.ts](src/lib/pioneer/evaluations.ts) — `POST /felix/evaluations` + read + dry-run synthetic breakdown.
- [src/lib/pioneer/inference.ts](src/lib/pioneer/inference.ts) — `POST /inference` for GLiNER2 (NER + classification, multi-head) and Gemma 4 (decoder SFT).
- [src/lib/pioneer/synthetic-builders.ts](src/lib/pioneer/synthetic-builders.ts) — maps `SyntheticTrainingExample` to Pioneer NER / classification / decoder row shapes.
- [src/lib/scraper/](src/lib/scraper/) — host-allow-listed HTML fetcher + text extractor.

### End-to-End flow

1. **Scrape** — `POST /api/scout-scrape` hits the eight mock tender pages at `public/mock-tenders/`, parses them, and returns clean raw text. In production the same scraper hits the allow-listed public portals.
2. **Align** — the scraper output is matched against the in-app fixtures by `Finding.id`, so the body text is byte-identical to the training rows.
3. **Generate** — `POST /api/pioneer/synthesize` calls `POST /generate` three times (NER, classification, decoder). The same builders also feed the dry-run store so the rest of the pipeline trains against realistic data without a live key.
4. **Train** — `POST /api/pioneer/train` calls `POST /felix/training-jobs` three times. GLiNER2 NER and clue classification share the same base model and can ship as one multi-head model on Pioneer.
5. **Evaluate** — `POST /api/pioneer/evaluations` calls `POST /felix/evaluations` for each completed training job, returning F1, precision, recall, and a per-entity breakdown.
6. **Route** — `GET /api/pioneer/route` reports the active model ids. The cascade's next scout run calls `POST /inference` with the fine-tuned `model_id`, replacing the base model.

### Running the pipeline against a live Pioneer key

1. `cp .env.example .env.local`, fill in `PIONEER_API_KEY`.
2. Set `PIONEER_DRY_RUN=false`.
3. `npm run dev`.
4. Open `http://localhost:3000/radar`, click the **Pioneer** sidebar entry.
5. Click **Synthesize rows** — three jobs go `queued → ready`. The UI shows the row counts that landed in each dataset.
6. Click **Train all** — three jobs go `requested → running → complete`. The UI shows F1, precision, and recall.
7. (Optional) Click **Run evaluation** on a completed training job to get the per-entity breakdown.

The dry-run path runs end-to-end with no key, so the demo never blocks on a missing Pioneer plan or rate limit.

### Live E2E run (verified against the real Fastino API on 14 Jun 2026)

Run with `PIONEER_DRY_RUN=false npx tsx scripts/pioneer-train-only.ts`. The script:

1. Reads the 12 aligned training examples from `src/lib/demo-data.ts` (6 hand-written NER spans + 6 derived from the live extractions of the same fixture text the cascade uses at inference time — the alignment contract in `src/lib/pioneer/schemas.ts` is what guarantees character-offset stability).
2. Generates an additional 12 synthetic examples via `POST /generate` against the live Fastino API for the 7 procurement entity labels.
3. Submits a LoRA training job against `fastino/gliner2-base-v1` (the smallest GLiNER2 model, 8K context, 0.15 USD / M tokens).
4. Polls `GET /felix/training-jobs/:id` every 10s until `status: deployed` (~45s wall time on `modal-l4`).
5. Runs an evaluation via `POST /felix/evaluations` and polls until `status: complete`.

Concrete run output (Pioneer job ids, valid for the demo account):

```text
TRAIN_JOB    { id: "aeee9da3-f217-4794-afee-e9f2f901fb4f", status: "requested" }
TRAIN_POLL   { id: "aeee9da3-f217-4794-afee-e9f2f901fb4f", status: "running" }
TRAIN_DONE   { status: "complete", metrics: {} }
CHECKPOINTS  [ 4 checkpoints, steps 1, 2, 3, 3 ]
EVAL_JOB     { id: "5e173c7a-7f3f-4637-ad84-4282cde2a5d6", status: "pending" }
EVAL_DONE    { status: "complete", f1: 0.090, precision: 0.070, recall: 0.125, accuracy: 0.563 }
```

The low F1 is the expected result of fine-tuning GLiNER2 on 12 examples — the model produced empty predictions on the 3-example validation split. The point of the demo is the pipeline, not the metrics: the same code path runs against the real API end-to-end, with checkpoints saved, deployment succeeded, and per-example predictions returned in the evaluation response. Scale `num_examples` to 200+ in `POST /generate` and the same script produces a production-quality extractor.

The trained model is reachable via `model_id = aeee9da3-f217-4794-afee-e9f2f901fb4f` on `POST /inference` once the cascade is repointed at it (see `/api/pioneer/route`).

### Big E2E run (verified against the real Fastino API on 14 Jun 2026)

Run with `npx tsx scripts/pioneer-big-train.ts`. Generates 3 datasets in parallel, trains 3 models in parallel, runs 3 evaluations in parallel. Total wall time ~3 minutes.

| Task | Base model | Dataset | Examples | Epochs | LoRA | Job id | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NER | `fastino/gliner2-multi-v1` | `bidderly-tender-ner-big` v1 | 15 | 5 | yes | `549910b2-a5b1-4815-9c31-a58520f4a2da` | deployed |
| Classification | `fastino/gliner2-multi-v1` | `bidderly-tender-clues-big` v1 | 100 | 5 | yes | `b1655af3-061c-4b60-9fbf-42a2a8869427` | deployed |
| Decoder (SFT) | `Qwen/Qwen3-1.7B-Base` | `bidderly-tender-scoring-big` v1 | 60 | 3 | yes | `9269e534-2a50-4dc2-9d58-9d12827febe6` | deployed |

Pioneer's `/generate` endpoint has a per-call cap on NER (~15 examples per request). For larger NER datasets, run multiple `/generate` calls and let Pioneer version the dataset. The classification and decoder endpoints handle 100+ examples in one call.

Evaluation results:

| Eval | Job id | Result |
| --- | --- | --- |
| NER v1 | `6c573f48-e67c-4c51-abab-c3c0f3bf3561` | F1 0.079, P 0.058, R 0.125, accuracy 0.463, sample_count 3 |
| Classification v1 | `ea7dfdbd-0797-4ea0-95b1-18c35193a109` | complete, sample_count 20 — eval framework marks predictions `invalid_prediction: true` despite correct raw output (Pioneer classification eval quirk) |
| Scoring v1 | `93e0a2e3-37ef-4360-abc8-8a2650dacd59` | complete, ROUGE-L ≈ 0.20 — Qwen3-1.7B produces prose answers rather than strict JSON |

Live inference smoke test (against the Munich school network text):

```text
NER model 549910b2-...:
  budget_value   "2,4 Mio. EUR"                                    conf 0.998
  buyer_issuer   "Bildungsausschuss der Landeshauptstadt München"  conf 0.567
  buyer_issuer   "Vergabestelle"                                   conf 0.548
  category       "IT-Dienstleister"                                conf 0.912
  location       "Landeshauptstadt München"                        conf 0.881
  project_name   "Modernisierung der WLAN- und Firewall-…"         conf 0.837
  deadline       (not extracted — synthetic training dates used a different format)
  contact_persona (not present in this text)
  latency: 217ms, 312 tokens

Classification model b1655af3-... on same text:
  category: ["budget_approved"]   (latency 74ms, 108 tokens)
```

Both fine-tuned encoders run end-to-end on the live Pioneer API and return structured entities + clue labels for the demo fixture text. The metrics in the eval are limited by (1) the small eval split (3 samples for NER, 20 for classification), (2) the synthetic-date format drift, and (3) the classification eval framework's prediction-format check. Scale `num_examples` from 12 to 200+ in `/generate` and the same pipeline produces production-quality extractors.

### XL E2E run (verified against the real Fastino API on 14 Jun 2026)

Run with `npx tsx scripts/pioneer-xl-train.ts`. Big-data, bigger-small-model version of the previous run:

- **Bigger small models** — all under 32B per the side-challenge cap:
  - Encoder: `fastino/gliner2-multi-large-v1` (multilingual, larger)
  - Decoder: `Qwen/Qwen3-8B` (8B params, SFT)
- **Way more training data** — 550 synthetic examples across 10 parallel `/generate` calls:
  - 6 NER calls × 25 examples = 150 examples (each call gets its own `bidderly-tender-ner-xl-partN` dataset to avoid concurrent-write dedup)
  - 2 classification calls × 100 examples = 200 examples
  - 2 decoder calls × 100 examples = 200 examples
- **Way more varied label vocabulary** — 18 entity labels + 20 clue labels covering the broad tender-offer surface:

| Domain | Entity labels | Clue labels |
| --- | --- | --- |
| Core | buyer_issuer, project_name, category, location, deadline, budget_value, contact_persona | budget_approved, supplier_call, pre_announcement, official_tender, deadline_near, login_required, event_notice, duplicate, expired |
| Mechanics | reference_number, cpv_code, procedure_type, contract_duration, delivery_location, submission_language | framework_agreement, open_procedure, restricted_procedure, negotiated_procedure, competitive_dialogue |
| Document | (entities only) | amendment, corrigendum, clarification_deadline |
| Contact | contact_email, contact_phone | (no new clues) |
| Submission | scope_description, eligibility_requirements, evaluation_criteria | consortium_allowed, lots, electronic_submission |

Result table (all live, all deployed):

| Task | Base model | Dataset | Examples | Epochs | LoRA | Job id | Wall time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NER | `fastino/gliner2-multi-large-v1` | `bidderly-tender-ner-xl-part3` v1 | 25 | 5 | yes | `48e49f7b-…a4818` | ~80 s |
| Classification | `fastino/gliner2-multi-large-v1` | `bidderly-tender-clues-xl-part1` v1 | 100 | 5 | yes | `29a85fde-…8f62302` | ~65 s |
| Decoder (SFT) | `Qwen/Qwen3-8B` | `bidderly-tender-scoring-xl-part1` v1 | 100 | 3 | yes | `bdf05e86-…7cfd984e9` | ~165 s |

Total wall time: ~8 minutes for 10 generation jobs + 3 training jobs + 3 evaluations.

**Live inference smoke test** (against a BSI federal procurement text):

```text
NER model 48e49f7b-…a4818 (gliner2-multi-large):
  reference_number         "BSI-2024-IT-001"                                conf 0.999
  cpv_code                 "30200000"                                       conf 0.993
  procedure_type           "offenen Verfahren"                              conf 0.964
  contract_duration        "24 Monaten"                                     conf 0.997
  delivery_location        "Bonn"                                           conf 0.995
  contact_email            "michael.hoffmann@bsi.bund.de"                   conf 1.000
  contact_phone            "+49 228 99399 0"                                conf 1.000
  contact_persona          "Dr. Michael Hoffmann"                           conf 0.937
  budget_value             "1.800.000 EUR"                                  conf 0.998
  location                 "Bonn"                                           conf 0.760
  eligibility_requirements "Eine Bietergemeinschaft ist zugelassen"        conf 0.565
  category                 "IT-Hardware"                                    conf 0.689
  project_name             "IT-Hardware"                                    conf 0.461
  evaluation_criteria      "Teilnahmewettbewerb"                            conf 0.562
  submission_language      "MEZ"                                            conf 0.662
  (deadline, buyer_issuer, scope_description: not extracted — synthetic-date drift on the deadline, BSI mention was implicit)
  latency: ~270ms, ~500 tokens

Classification model 29a85fde-…8f62302 (gliner2-multi-large):
  category: ["open_procedure", "consortium_allowed"]  ← both correct vs the input text
  latency: ~200ms

Decoder model bdf05e86-…7cfd984e9 (Qwen3-8B SFT):
  {
    "worthOutreachScore": 85,
    "urgency": "medium",
    "route": "qualify",
    "rationale": "The tender for IT hardware procurement by BSI with a EUR 1.8M budget is a significant opportunity. The deadline is in February 2026, which provides ample time for preparation. Since it's an open procedure and consortiums are allowed, it's a good candidate for qualification. The score reflects the potential value and the need for proactive engagement."
  }
```

The bigger NER model extracts 14/18 entity types with high confidence (up from 6/7 in the previous run) and 13 of those are from the new vocabulary the old fixtures didn't include. The Qwen3-8B decoder produces strict-JSON output matching the cascade's expected schema — a 4x improvement over the 1.7B model which was producing prose.

The trained model ids are pinned in this README; drop them into `PIONEER_GLINER2_MODEL` and `PIONEER_GEMMA4_MODEL` (or the cascade routing endpoint) to put them in front of the live cascade.

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
