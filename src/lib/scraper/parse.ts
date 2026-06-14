// HTML -> rawText. Strips scripts, styles, and SVG, then collapses
// whitespace. No external dependencies.

const STRIP = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<style\b[^>]*>[\s\S]*?<\/style>/gi,
  /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
  /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
  /<template\b[^>]*>[\s\S]*?<\/template>/gi,
  /<!--([\s\S]*?)-->/g,
];

const COLLAPSE_WS = /[ \t\f\v]+/g;
const COLLAPSE_NEWLINES = /(\s*\n\s*){2,}/g;

export function extractRawText(html: string): string {
  let out = html;
  for (const rx of STRIP) out = out.replace(rx, " ");
  // Replace block-level closers with newlines so paragraph boundaries survive.
  out = out.replace(/<\/(p|div|li|h[1-6]|tr|td|th|br|hr|article|section|header|footer|main|aside)\s*>/gi, "\n");
  // Drop remaining tags.
  out = out.replace(/<[^>]+>/g, " ");
  // Decode the few entities that show up in real tender pages.
  out = out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  // Collapse whitespace.
  out = out.replace(COLLAPSE_WS, " ");
  out = out.replace(COLLAPSE_NEWLINES, "\n\n");
  return out.trim();
}

const TENDER_ID_META = /<meta\s+name=["']tender-id["']\s+content=["']([^"']+)["']\s*\/?>/i;
const TENDER_LANG_META = /<meta\s+name=["']tender-language["']\s+content=["']([^"']+)["']\s*\/?>/i;
const TENDER_TITLE_META = /<meta\s+name=["']tender-title["']\s+content=["']([^"']+)["']\s*\/?>/i;

export type ParsedPage = {
  rawText: string;
  tenderId: string | null;
  detectedLanguage: "de" | "en" | null;
  title: string | null;
};

export function parseTenderPage(html: string): ParsedPage {
  const tenderId = html.match(TENDER_ID_META)?.[1] ?? null;
  const detectedLanguage = (html.match(TENDER_LANG_META)?.[1] as "de" | "en" | null) ?? null;
  const title = html.match(TENDER_TITLE_META)?.[1] ?? null;
  return { rawText: extractRawText(html), tenderId, detectedLanguage, title };
}

export function detectLanguageHeuristic(text: string): "de" | "en" {
  return /[äöüß]|\b(der|die|das|und|fuer|für|ist|ein|eine)\b/i.test(text) ? "de" : "en";
}
