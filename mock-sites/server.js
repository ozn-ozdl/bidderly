// Bidderly mock-tender-portals service.
//
// Serves four distinct mock tender portals at `/ted-eu/`, `/bund-de/`,
// `/stadt-muenchen/`, and `/berlin-de/`. Each portal has its own visual
// theme (TED blue, Bund red, Munich green, Berlin purple), HTML
// structure, and tender listings so the Bidderly.live scraper and
// the Pioneer-fine-tuned extraction models see real structural
// variation, not four copies of the same page.
//
// Endpoints:
//   GET /health                    -> { ok: true, portals: [...] }
//   GET /                         -> index linking to the four portals
//   GET /ted-eu/                  -> TED EU portal home
//   GET /ted-eu/tender-N.html     -> individual tender detail
//   GET /bund-de/...              -> same shape
//   GET /stadt-muenchen/...       -> same shape
//   GET /berlin-de/...            -> same shape

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import Fastify from "fastify";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SITES_DIR = resolve(__dirname, "sites");

const PORT = Number(process.env.PORT ?? 3002);
const HOST = process.env.HOST ?? "0.0.0.0";

const PORTALS = [
  { slug: "ted-eu", name: "TED EU — Tenders Electronic Daily", theme: "ted" },
  { slug: "bund-de", name: "Bund.de — Bundesweite Vergaben", theme: "bund" },
  { slug: "stadt-muenchen", name: "stadt.muenchen.de — Münchner Vergaben", theme: "munich" },
  { slug: "berlin-de", name: "berlin.de — Berliner Vergabeplattform", theme: "berlin" },
];

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
});

await app.register(cors, { origin: true });

// All portal pages live under sites/<slug>/. Serve the directory
// as a static root. /ted-eu/ resolves to sites/ted-eu/index.html,
// /ted-eu/tender-1.html to sites/ted-eu/tender-1.html, etc.
await app.register(staticPlugin, {
  root: SITES_DIR,
  prefix: "/",
  index: ["index.html"],
  decorateReply: false,
  cacheControl: true,
  maxAge: "5m",
});

// Health endpoint used by Railway's healthcheck.
app.get("/health", async () => ({
  ok: true,
  service: "bidderly-mock-sites",
  portals: PORTALS.map((p) => ({ slug: p.slug, name: p.name })),
  port: PORT,
  uptimeSeconds: Math.round(process.uptime()),
}));

// Root index: small landing page that links to the four portals.
// Served as a route so the file lives in the static tree as
// sites/index.html, but we also expose a JSON discovery variant.
app.get("/api/portals", async () => ({
  portals: PORTALS.map((p) => ({
    slug: p.slug,
    name: p.name,
    theme: p.theme,
    home: `/${p.slug}/`,
  })),
}));

app.get("/", async (_req, reply) => {
  return reply.type("text/html; charset=utf-8").send(rootIndexHtml());
});

function rootIndexHtml() {
  const cards = PORTALS.map(
    (p) => `
      <a class="portal-card portal-${p.theme}" href="/${p.slug}/">
        <span class="portal-name">${escapeHtml(p.name)}</span>
        <span class="portal-href">/${p.slug}/</span>
      </a>`,
  ).join("\n");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="tender-language" content="en" />
    <meta name="tender-title" content="Bidderly mock tender portal index" />
    <title>Bidderly mock tender portals</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        background: #0b0d12;
        color: #e6e8ee;
        line-height: 1.5;
      }
      .page { max-width: 960px; margin: 0 auto; padding: 4rem 1.5rem 6rem; }
      h1 { font-size: 2rem; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
      p.lede { color: #a4abb9; max-width: 60ch; margin: 0 0 2.5rem; }
      .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .portal-card {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 1.5rem;
        border-radius: 14px;
        text-decoration: none;
        color: inherit;
        background: #14171f;
        border: 1px solid #232735;
        transition: transform 120ms ease, border-color 120ms ease;
      }
      .portal-card:hover { transform: translateY(-2px); border-color: #2f3346; }
      .portal-card .portal-name { font-weight: 600; }
      .portal-card .portal-href { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; color: #7d8497; }
      .accent-bar { width: 56px; height: 4px; border-radius: 2px; background: linear-gradient(90deg, #4b6cff, #a16bff); margin-bottom: 1.5rem; }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="accent-bar"></div>
      <h1>Bidderly mock tender portals</h1>
      <p class="lede">Four distinct public-procurement portals served by this Railway service. The Bidderly.live cascade discovers URLs here via Tavily, scrapes each portal, and feeds the text through a Pioneer-fine-tuned GLiNER2 + Gemma 4 cascade. Each portal uses a different visual theme, layout, and language mix so the extraction model is exercised on varied structure.</p>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

app.setNotFoundHandler((req, reply) => {
  reply.code(404).type("text/plain").send(`not found: ${req.url}`);
});

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(
    `mock-sites listening on :${PORT} — portals: ${PORTALS.map((p) => p.slug).join(", ")}`,
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
