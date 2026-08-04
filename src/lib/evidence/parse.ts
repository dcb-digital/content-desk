/**
 * Parses CSV/TSV evidence exports into NormalizedEvidence.
 *
 * Design contract: **nothing is silently dropped.**
 *  - Headers are normalised (case, punctuation, units, date-range suffixes) then matched
 *    against an alias table, so "Clicks 6/1/26-6/30/26" and "Clics" both resolve.
 *  - A repeated column (date-comparison exports) becomes the `*Prev` field.
 *  - Any column that doesn't map to a typed field is preserved verbatim in `extra`,
 *    keyed by its original header.
 *  - A file whose shape can't be classified at all is stored verbatim in `unmapped`.
 *  - Anything capped or skipped is reported in `warnings` — never dropped in silence.
 */
import type {
  EvidenceBacklinkRow,
  EvidenceContentGapRow,
  EvidenceDimensionRow,
  EvidenceKeywordRow,
  EvidencePageRow,
  EvidenceQueryRow,
  EvidenceUnmappedTable,
  NormalizedEvidence,
} from "@/db/schema";

export type EvidenceFormat =
  | "gsc"
  | "gsc_pages"
  | "ahrefs"
  | "semrush"
  | "ga4"
  | "backlinks"
  | "content_gap"
  | "dimensions"
  | "mixed"
  | "unknown";

export type ParsedEvidence = {
  data: NormalizedEvidence;
  rowCounts: Record<string, number>;
  format: EvidenceFormat;
  /** original headers, in file order — the audit trail of what was captured */
  headers: string[];
  warnings: string[];
};

/** Extensions we can read as text. Spreadsheets (.xlsx) must be exported to CSV first. */
export const EVIDENCE_FILE_EXTENSIONS = [".csv", ".tsv", ".txt"] as const;

/** Row caps, so one enormous export can't blow up the jsonb column. */
const MAX_ROWS_PER_COLLECTION = 50_000;
const MAX_UNMAPPED_ROWS = 2_000;

export function isSupportedEvidenceFile(name: string): boolean {
  const lower = name.toLowerCase();
  return EVIDENCE_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/* ============================ CSV reading ============================ */

function detectSeparator(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    const tabs = (line.match(/\t/g) ?? []).length;
    const semis = (line.match(/;/g) ?? []).length;
    const commas = (line.match(/,/g) ?? []).length;
    const max = Math.max(tabs, semis, commas);
    if (max === 0) continue;
    if (max === tabs) return "\t";
    if (max === semis) return ";";
    return ",";
  }
  return ",";
}

/** RFC4180-ish tokenizer: handles quoted fields containing separators and newlines. */
function tokenize(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === sep) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  row.push(field.trim());
  rows.push(row);

  return rows.filter((r) => r.some((v) => v !== ""));
}

/**
 * Strips case, wrapping punctuation, bracketed units and trailing date ranges so
 * header variants collapse onto one canonical spelling.
 *   "Clicks 6/1/26-6/30/26"          → "clicks"
 *   "Impressions (2026-06-01 - ...)" → "impressions"
 *   "Avg. position"                  → "avg position"
 */
function normaliseHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/﻿/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\b/g, " ")
    .replace(/\b(19|20)\d{6}\b/g, " ")
    .replace(/[^a-z0-9%/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Table = {
  /** original headers in file order */
  headers: string[];
  /** normalised keys, parallel to headers; repeats suffixed "#2", "#3" */
  keys: string[];
  /** normalised key → original header */
  origin: Record<string, string>;
  rows: Record<string, string>[];
  decimal: "," | ".";
};

/** Every header spelling we know — built lazily, FIELD_ALIASES is declared below. */
let knownHeaders: Set<string> | null = null;
function isKnownHeader(header: string): boolean {
  knownHeaders ??= new Set(Object.values(FIELD_ALIASES).flat());
  return knownHeaders.has(header);
}

function readTable(text: string): Table | null {
  const clean = text.replace(/^﻿/, "");
  const sep = detectSeparator(clean);
  const lines = tokenize(clean, sep);
  if (!lines.length) return null;

  // Skip preamble (GSC/GA4 exports prepend title and date rows with no columns)
  const headerIdx = lines.findIndex((l) => l.length >= 2 && l.some((c) => c !== ""));
  let headers: string[];
  let dataStart: number;

  if (headerIdx !== -1) {
    headers = lines[headerIdx];
    dataStart = headerIdx + 1;
  } else {
    // Single-column file — e.g. a bare keyword list. Only treat line 1 as the
    // header if it actually names a field, otherwise every line is data.
    const first = normaliseHeader(lines[0][0] ?? "");
    if (isKnownHeader(first)) {
      headers = lines[0];
      dataStart = 1;
    } else {
      headers = ["value"];
      dataStart = 0;
    }
  }

  if (dataStart >= lines.length) return null;
  const keys: string[] = [];
  const origin: Record<string, string> = {};
  const seen = new Map<string, number>();

  headers.forEach((h, i) => {
    const base = normaliseHeader(h) || `column ${i + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const key = count === 1 ? base : `${base}#${count}`;
    keys.push(key);
    origin[key] = h || `Column ${i + 1}`;
  });

  const rows: Record<string, string>[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const values = lines[i];
    const row: Record<string, string> = {};
    keys.forEach((k, j) => {
      row[k] = values[j] ?? "";
    });
    rows.push(row);
  }

  return { headers, keys, origin, rows, decimal: detectDecimal(rows) };
}

/**
 * Votes on the file's decimal separator. Grouped forms ("1.300" vs "1,300") are
 * strong signals; bare two-decimal forms ("6,67") are weaker tie-breakers.
 */
function detectDecimal(rows: Record<string, string>[]): "," | "." {
  let eu = 0;
  let us = 0;
  for (const row of rows.slice(0, 200)) {
    for (const v of Object.values(row)) {
      if (/^-?\d{1,3}(\.\d{3})+(,\d+)?%?$/.test(v)) eu += 2;
      else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?%?$/.test(v)) us += 2;
      else if (/^-?\d+,\d{1,2}%?$/.test(v)) eu += 1;
      else if (/^-?\d+\.\d{1,2}%?$/.test(v)) us += 1;
    }
  }
  return eu > us ? "," : ".";
}

/* ========================= Value conversion ========================= */

const BLANK = /^(n\/?a|na|none|null|undefined|-{1,2}|–|—|\.{3}|)$/i;

function toNumber(raw: string | undefined, decimal: "," | "."): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (BLANK.test(trimmed)) return undefined;

  // "<10", "~1.2K", ">1,000"
  let s = trimmed.replace(/^[<>~≈]+/, "");
  // keep digits, separators, sign, percent and magnitude suffixes only
  s = s.replace(/[^\d.,%kmb+-]/gi, "");
  if (!/\d/.test(s)) return undefined;

  const suffix = /([kmb])$/i.exec(s)?.[1]?.toLowerCase();
  if (suffix) s = s.slice(0, -1);
  s = s.replace(/%/g, "");

  if (decimal === ",") s = s.replace(/\./g, "").replace(/,/g, ".");
  else s = s.replace(/,/g, "");

  const n = parseFloat(s);
  if (isNaN(n)) return undefined;

  const mult = suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : suffix === "b" ? 1e9 : 1;
  return n * mult;
}

/** Percentages are stored as fractions. Exports use "6.67%", "6.67" and "0.0667". */
function toFraction(raw: string | undefined, decimal: "," | "."): number | undefined {
  const n = toNumber(raw, decimal);
  if (n === undefined) return undefined;
  if (raw?.includes("%")) return n / 100;
  return n > 1 ? n / 100 : n;
}

/** GA4 durations arrive as "00:01:24", "84" (seconds) or "1m 24s". */
function toSeconds(raw: string | undefined, decimal: "," | "."): number | undefined {
  if (!raw || BLANK.test(raw.trim())) return undefined;
  const clock = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(raw.trim());
  if (clock) {
    const [, a, b, c] = clock;
    return c
      ? Number(a) * 3600 + Number(b) * 60 + Number(c)
      : Number(a) * 60 + Number(b);
  }
  const units = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i.exec(raw.trim());
  if (units && (units[1] || units[2] || units[3])) {
    return Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0);
  }
  return toNumber(raw, decimal);
}

function toBool(raw: string | undefined): boolean | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (["true", "yes", "y", "1", "nofollow"].includes(s)) return true;
  if (["false", "no", "n", "0", "dofollow", "follow"].includes(s)) return false;
  return undefined;
}

function toText(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  return BLANK.test(t) ? undefined : t;
}

/* =========================== Column mapping ========================= */

/**
 * field name → exact normalised header spellings.
 * Includes the localised GSC column names (es, de, fr, pt, it, nl) because the
 * export language follows the Search Console UI, not the property.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  // --- identifiers
  query: [
    "query", "queries", "top queries", "search query", "search queries", "search term", "search terms",
    "consulta", "consultas", "consulta principal", "requete", "requetes", "suchanfrage", "suchanfragen",
    "zoekopdracht", "zoekopdrachten", "query di ricerca", "consulta de pesquisa", "pesquisa",
  ],
  keyword: ["keyword", "keywords", "palabra clave", "palabras clave", "schlusselwort", "mot cle", "parola chiave"],
  url: [
    "page", "pages", "top pages", "url", "urls", "address", "landing page", "landing page query string",
    "page path", "page path and screen class", "page path and screen name", "page location", "page url",
    "final url", "target page", "current url", "current page", "ranking url", "ranking page",
    "pagina", "paginas", "seite", "seiten", "pagina di destinazione",
  ],
  title: ["title", "page title", "meta title", "source title", "titulo", "titel"],

  // --- GSC / search metrics
  clicks: ["clicks", "url clicks", "total clicks", "clics", "clics de url", "klicks", "cliques", "clic", "kliks"],
  impressions: [
    "impressions", "total impressions", "impresiones", "impressionen", "impressoes", "impressioni",
    "impressies", "affichages",
  ],
  ctr: [
    "ctr", "click through rate", "clickthrough rate", "site ctr", "average ctr", "avg ctr",
    "porcentaje de clics", "klickrate", "taux de clics", "taxa de cliques",
  ],
  position: [
    "position", "average position", "avg position", "avg pos", "pos", "current position", "rank",
    "posicion", "posicion media", "durchschnittliche position", "position moyenne", "posicao",
    "posizione", "gemiddelde positie",
  ],
  previousPosition: ["previous position", "prev position", "position before", "previous pos"],
  searchAppearance: ["search appearance", "appearance", "rich result type"],

  // --- keyword research metrics
  volume: ["volume", "search volume", "monthly searches", "monthly search volume", "avg monthly searches", "sv"],
  difficulty: ["kd", "keyword difficulty", "difficulty", "kd %", "competition"],
  cpc: ["cpc", "cost per click", "avg cpc", "cpc usd"],
  traffic: ["traffic", "organic traffic", "estimated traffic", "traffic est", "et"],
  trafficValue: ["traffic value", "traffic cost", "traffic potential value", "value"],
  trafficPercent: ["traffic %", "traffic share", "% of traffic"],
  intent: ["intent", "search intent", "keyword intent"],
  parentTopic: ["parent topic", "parent keyword"],
  serpFeatures: ["serp features", "serp feature"],
  competitiveDensity: ["competitive density", "com", "competition density"],
  results: ["results", "number of results", "serp results"],
  trend: ["trend", "trends", "monthly trend"],

  // --- GA4 metrics
  sessions: ["sessions", "sesiones", "sitzungen", "sessoes", "sessioni"],
  users: ["users", "total users", "active users", "usuarios", "nutzer"],
  newUsers: ["new users", "first time users"],
  views: ["views", "screen page views", "pageviews", "page views", "vistas"],
  engagementRate: ["engagement rate", "engaged sessions per user", "tasa de interaccion"],
  bounceRate: ["bounce rate", "porcentaje de rebote", "absprungrate"],
  avgEngagementTime: [
    "average engagement time", "avg engagement time", "average engagement time per session",
    "average session duration", "avg session duration", "engagement time",
  ],
  eventCount: ["event count", "events", "total events"],
  conversions: ["conversions", "key events", "goal completions", "conversiones", "conversion"],
  revenue: ["revenue", "total revenue", "purchase revenue", "event value", "ingresos"],

  // --- backlink metrics
  sourceUrl: ["source url", "referring page url", "referring page", "source page", "from url", "backlink url"],
  targetUrl: ["target url", "to url", "destination url", "linked page"],
  anchor: ["anchor", "anchor text", "link anchor"],
  domainRating: ["dr", "domain rating", "domain authority", "da"],
  authorityScore: ["page ascore", "authority score", "as", "page score"],
  nofollow: ["nofollow", "no follow", "link type", "follow"],
  firstSeen: ["first seen", "first indexed", "discovered"],
  lastSeen: ["last seen", "last checked"],

  // --- standalone dimensions
  country: ["country", "countries", "pais", "land", "pays", "location"],
  device: ["device", "devices", "device category", "dispositivo", "gerat", "appareil"],
  date: ["date", "day", "dates", "fecha", "datum", "week", "month", "yearmonth"],
  channelGroup: [
    "session default channel group", "first user default channel group", "default channel group",
    "session primary channel group", "channel group", "channel",
  ],
  sourceMedium: [
    "session source / medium", "first user source / medium", "source / medium", "source medium",
    "session source", "session medium",
  ],
  campaign: ["session campaign", "campaign", "session manual campaign name"],
  eventName: ["event name", "evento"],
};

/** Fields that can carry a second, previous-period column in comparison exports. */
const COMPARABLE = new Set([
  "clicks", "impressions", "ctr", "position", "sessions", "users", "views", "conversions", "revenue",
]);

/** Columns that can stand in as the row's dimension when there's no query/url/keyword. */
const DIMENSION_FIELDS = [
  "country", "device", "date", "searchAppearance", "channelGroup", "sourceMedium", "campaign", "eventName",
] as const;

const NUMERIC_FIELDS = new Set([
  "clicks", "impressions", "position", "previousPosition", "volume", "difficulty", "cpc", "traffic",
  "trafficValue", "competitiveDensity", "results", "sessions", "users", "newUsers", "views",
  "eventCount", "conversions", "revenue", "domainRating", "authorityScore",
]);
const FRACTION_FIELDS = new Set(["ctr", "engagementRate", "bounceRate", "trafficPercent"]);

type ColumnMap = Record<string, string>;

/** Resolves each known field to a column key. Repeats become `<field>Prev`. */
function mapColumns(keys: string[]): ColumnMap {
  const byBase = new Map<string, string[]>();
  for (const key of keys) {
    const base = key.replace(/#\d+$/, "");
    const list = byBase.get(base) ?? [];
    list.push(key);
    byBase.set(base, list);
  }

  const map: ColumnMap = {};
  const taken = new Set<string>();

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const matches: string[] = [];
    for (const alias of aliases) {
      for (const key of byBase.get(alias) ?? []) {
        if (!taken.has(key)) matches.push(key);
      }
    }
    if (!matches.length) continue;
    map[field] = matches[0];
    taken.add(matches[0]);
    if (matches[1] && COMPARABLE.has(field)) {
      map[`${field}Prev`] = matches[1];
      taken.add(matches[1]);
    }
  }
  return map;
}

/** Header that is literally a domain — how content-gap exports name competitors. */
function isDomainHeader(header: string): boolean {
  return /^(https?:\/\/)?([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}\/?$/i.test(header.trim());
}

/* ========================== Classification ========================== */

type Shape =
  | "backlinks"
  | "content_gap"
  | "queries"
  | "pages"
  | "keywords"
  | "dimensions"
  | "unmapped";

const METRIC_FIELDS = [...NUMERIC_FIELDS, ...FRACTION_FIELDS];

function classify(t: Table, cm: ColumnMap, competitorKeys: string[]): Shape {
  const hasMetric = METRIC_FIELDS.some((f) => cm[f]);
  if (cm.sourceUrl) return "backlinks";
  if ((cm.keyword || cm.query) && competitorKeys.length) return "content_gap";
  // A query/keyword column identifies the row; a URL column is secondary to it.
  // Keyword-ranking exports (Ahrefs, SEMrush) carry both.
  if (cm.query) return "queries";
  if (cm.keyword) return "keywords";
  if (cm.url) return "pages";
  if (DIMENSION_FIELDS.some((f) => cm[f]) && hasMetric) return "dimensions";
  return "unmapped";
}

/** Which fields each shape reads — everything else becomes `extra`. */
const SHAPE_FIELDS: Record<Exclude<Shape, "unmapped">, string[]> = {
  queries: [
    "query", "clicks", "impressions", "ctr", "position", "url", "country", "device", "date",
    "searchAppearance",
  ],
  pages: [
    "url", "title", "clicks", "impressions", "ctr", "position", "sessions", "users", "newUsers",
    "views", "engagementRate", "bounceRate", "avgEngagementTime", "eventCount", "conversions", "revenue",
  ],
  keywords: [
    "keyword", "volume", "position", "previousPosition", "url", "difficulty", "cpc", "traffic",
    "trafficValue", "trafficPercent", "intent", "parentTopic", "serpFeatures", "competitiveDensity",
    "results", "country", "trend",
  ],
  content_gap: ["keyword", "query", "volume", "position"],
  backlinks: [
    "sourceUrl", "sourceTitle", "title", "targetUrl", "anchor", "domainRating", "authorityScore",
    "nofollow", "firstSeen", "lastSeen",
  ],
  dimensions: [
    ...DIMENSION_FIELDS, "clicks", "impressions", "ctr", "position", "sessions", "users",
    "conversions", "revenue",
  ],
};

/* ============================== Parsing ============================= */

export function parseEvidence(csvText: string, sourceName?: string): ParsedEvidence {
  const t = readTable(csvText);
  if (!t || !t.rows.length) {
    return {
      data: {},
      rowCounts: {},
      format: "unknown",
      headers: [],
      warnings: [
        `${label(sourceName)}no readable rows — the file has no delimited columns (expected a comma, tab or semicolon separated export).`,
      ],
    };
  }

  const warnings: string[] = [];
  const cm = mapColumns(t.keys);
  const competitorKeys = t.keys.filter((k) => isDomainHeader(t.origin[k]));
  const shape = classify(t, cm, competitorKeys);

  if (t.rows.length > MAX_ROWS_PER_COLLECTION) {
    warnings.push(
      `${label(sourceName)}kept the first ${MAX_ROWS_PER_COLLECTION.toLocaleString()} of ${t.rows.length.toLocaleString()} rows.`,
    );
  }
  const rows = t.rows.slice(0, MAX_ROWS_PER_COLLECTION);

  // Unclassifiable: keep headers + rows verbatim so the data is still available
  if (shape === "unmapped") {
    const kept = rows.slice(0, MAX_UNMAPPED_ROWS);
    if (rows.length > kept.length) {
      warnings.push(
        `${label(sourceName)}unrecognised layout — kept the first ${MAX_UNMAPPED_ROWS.toLocaleString()} of ${rows.length.toLocaleString()} rows verbatim.`,
      );
    } else {
      warnings.push(
        `${label(sourceName)}unrecognised layout — columns stored verbatim (${t.headers.join(", ")}).`,
      );
    }
    const table: EvidenceUnmappedTable = {
      label: sourceName,
      headers: t.headers,
      rows: kept.map((r) => renameToOriginal(r, t)),
    };
    return {
      data: { unmapped: [table] },
      rowCounts: { unmapped: kept.length },
      format: "unknown",
      headers: t.headers,
      warnings,
    };
  }

  const consumed = new Set(
    [
      ...SHAPE_FIELDS[shape],
      ...SHAPE_FIELDS[shape].map((f) => `${f}Prev`),
    ]
      .map((f) => cm[f])
      .filter((k): k is string => Boolean(k)),
  );
  if (shape === "content_gap") competitorKeys.forEach((k) => consumed.add(k));

  const ctx = { t, cm, consumed };
  const data: NormalizedEvidence = {};
  const rowCounts: Record<string, number> = {};

  switch (shape) {
    case "queries": {
      const queries = rows.map((r) => buildQuery(r, ctx)).filter((q) => q.query);
      if (queries.length) {
        data.queries = queries;
        rowCounts.queries = queries.length;
      }
      break;
    }
    case "pages": {
      const pages = rows.map((r) => buildPage(r, ctx)).filter((p) => p.url);
      if (pages.length) {
        data.pages = pages;
        rowCounts.pages = pages.length;
      }
      break;
    }
    case "keywords": {
      const keywords = rows.map((r) => buildKeyword(r, ctx)).filter((k) => k.keyword);
      if (keywords.length) {
        data.keywords = keywords;
        rowCounts.keywords = keywords.length;
      }
      break;
    }
    case "content_gap": {
      const gap = rows.flatMap((r) => buildContentGap(r, ctx, competitorKeys));
      if (gap.length) {
        data.contentGap = gap;
        rowCounts.contentGap = gap.length;
      }
      break;
    }
    case "backlinks": {
      const backlinks = rows.map((r) => buildBacklink(r, ctx)).filter((b) => b.sourceUrl);
      if (backlinks.length) {
        data.backlinks = backlinks;
        rowCounts.backlinks = backlinks.length;
      }
      break;
    }
    case "dimensions": {
      const dims = rows.map((r) => buildDimension(r, ctx)).filter((d): d is EvidenceDimensionRow => d !== null);
      if (dims.length) {
        data.dimensions = dims;
        rowCounts.dimensions = dims.length;
      }
      break;
    }
  }

  const total = Object.values(rowCounts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    warnings.push(
      `${label(sourceName)}recognised the layout but every row was empty (${t.headers.join(", ")}).`,
    );
    return { data: {}, rowCounts: {}, format: "unknown", headers: t.headers, warnings };
  }

  // Guard against the silent-zeros case: dimension parsed, metric columns didn't
  const metricKeys = METRIC_FIELDS.map((f) => cm[f]).filter(Boolean);
  if (!metricKeys.length) {
    warnings.push(
      `${label(sourceName)}no metric columns recognised — rows stored, but every metric is unset. Columns seen: ${t.headers.join(", ")}.`,
    );
  }

  return { data, rowCounts, format: detectFormat(shape, cm, t), headers: t.headers, warnings };
}

function label(sourceName?: string): string {
  return sourceName ? `${sourceName}: ` : "";
}

function renameToOriginal(row: Record<string, string>, t: Table): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== "") out[t.origin[k] ?? k] = v;
  }
  return out;
}

/* --------------------------- Row builders --------------------------- */

type Ctx = { t: Table; cm: ColumnMap; consumed: Set<string> };

function get(row: Record<string, string>, ctx: Ctx, field: string): string | undefined {
  const key = ctx.cm[field];
  return key ? row[key] : undefined;
}

function n(row: Record<string, string>, ctx: Ctx, field: string): number | undefined {
  return toNumber(get(row, ctx, field), ctx.t.decimal);
}

function frac(row: Record<string, string>, ctx: Ctx, field: string): number | undefined {
  return toFraction(get(row, ctx, field), ctx.t.decimal);
}

function s(row: Record<string, string>, ctx: Ctx, field: string): string | undefined {
  return toText(get(row, ctx, field));
}

/** Every column this shape didn't read, keyed by its original header. */
function extras(row: Record<string, string>, ctx: Ctx): { extra?: Record<string, string> } {
  const extra: Record<string, string> = {};
  for (const key of ctx.t.keys) {
    if (ctx.consumed.has(key)) continue;
    const value = row[key];
    if (value === undefined || value === "") continue;
    extra[ctx.t.origin[key] ?? key] = value;
  }
  return Object.keys(extra).length ? { extra } : {};
}

function buildQuery(row: Record<string, string>, ctx: Ctx): EvidenceQueryRow {
  return {
    query: s(row, ctx, "query") ?? s(row, ctx, "keyword") ?? "",
    clicks: n(row, ctx, "clicks") ?? 0,
    impressions: n(row, ctx, "impressions") ?? 0,
    ctr: frac(row, ctx, "ctr") ?? 0,
    position: n(row, ctx, "position") ?? 0,
    clicksPrev: n(row, ctx, "clicksPrev"),
    impressionsPrev: n(row, ctx, "impressionsPrev"),
    ctrPrev: frac(row, ctx, "ctrPrev"),
    positionPrev: n(row, ctx, "positionPrev"),
    page: s(row, ctx, "url"),
    country: s(row, ctx, "country"),
    device: s(row, ctx, "device"),
    date: s(row, ctx, "date"),
    searchAppearance: s(row, ctx, "searchAppearance"),
    ...extras(row, ctx),
  };
}

function buildPage(row: Record<string, string>, ctx: Ctx): EvidencePageRow {
  return {
    url: s(row, ctx, "url") ?? "",
    title: s(row, ctx, "title"),
    clicks: n(row, ctx, "clicks"),
    impressions: n(row, ctx, "impressions"),
    ctr: frac(row, ctx, "ctr"),
    position: n(row, ctx, "position"),
    clicksPrev: n(row, ctx, "clicksPrev"),
    impressionsPrev: n(row, ctx, "impressionsPrev"),
    sessions: n(row, ctx, "sessions"),
    users: n(row, ctx, "users"),
    newUsers: n(row, ctx, "newUsers"),
    views: n(row, ctx, "views"),
    engagementRate: frac(row, ctx, "engagementRate"),
    bounceRate: frac(row, ctx, "bounceRate"),
    avgEngagementTimeSec: toSeconds(get(row, ctx, "avgEngagementTime"), ctx.t.decimal),
    eventCount: n(row, ctx, "eventCount"),
    conversions: n(row, ctx, "conversions"),
    revenue: n(row, ctx, "revenue"),
    ...extras(row, ctx),
  };
}

function buildKeyword(row: Record<string, string>, ctx: Ctx): EvidenceKeywordRow {
  return {
    keyword: s(row, ctx, "keyword") ?? s(row, ctx, "query") ?? "",
    volume: n(row, ctx, "volume"),
    position: n(row, ctx, "position"),
    previousPosition: n(row, ctx, "previousPosition"),
    url: s(row, ctx, "url"),
    difficulty: n(row, ctx, "difficulty"),
    cpc: n(row, ctx, "cpc"),
    traffic: n(row, ctx, "traffic"),
    trafficValue: n(row, ctx, "trafficValue"),
    trafficPercent: frac(row, ctx, "trafficPercent"),
    intent: s(row, ctx, "intent"),
    parentTopic: s(row, ctx, "parentTopic"),
    serpFeatures: s(row, ctx, "serpFeatures"),
    competitiveDensity: n(row, ctx, "competitiveDensity"),
    results: n(row, ctx, "results"),
    country: s(row, ctx, "country"),
    trend: s(row, ctx, "trend"),
    ...extras(row, ctx),
  };
}

function buildContentGap(
  row: Record<string, string>,
  ctx: Ctx,
  competitorKeys: string[],
): EvidenceContentGapRow[] {
  const keyword = s(row, ctx, "keyword") ?? s(row, ctx, "query") ?? "";
  if (!keyword) return [];
  const volume = n(row, ctx, "volume");
  const ourPosition = n(row, ctx, "position");
  const shared = extras(row, ctx);

  const out: EvidenceContentGapRow[] = [];
  for (const key of competitorKeys) {
    const raw = row[key];
    if (!raw || BLANK.test(raw.trim())) continue;
    out.push({
      keyword,
      competitor: ctx.t.origin[key] ?? key,
      volume,
      ourPosition,
      competitorPosition: toNumber(raw, ctx.t.decimal),
      ...shared,
    });
  }
  return out;
}

function buildBacklink(row: Record<string, string>, ctx: Ctx): EvidenceBacklinkRow {
  return {
    sourceUrl: s(row, ctx, "sourceUrl") ?? "",
    sourceTitle: s(row, ctx, "title"),
    targetUrl: s(row, ctx, "targetUrl"),
    anchor: s(row, ctx, "anchor"),
    domainRating: n(row, ctx, "domainRating"),
    authorityScore: n(row, ctx, "authorityScore"),
    nofollow: toBool(get(row, ctx, "nofollow")),
    firstSeen: s(row, ctx, "firstSeen"),
    lastSeen: s(row, ctx, "lastSeen"),
    ...extras(row, ctx),
  };
}

function buildDimension(row: Record<string, string>, ctx: Ctx): EvidenceDimensionRow | null {
  const field = DIMENSION_FIELDS.find((f) => ctx.cm[f] && s(row, ctx, f));
  if (!field) return null;
  return {
    dimension: ctx.t.origin[ctx.cm[field]] ?? field,
    value: s(row, ctx, field) ?? "",
    clicks: n(row, ctx, "clicks"),
    impressions: n(row, ctx, "impressions"),
    ctr: frac(row, ctx, "ctr"),
    position: n(row, ctx, "position"),
    sessions: n(row, ctx, "sessions"),
    users: n(row, ctx, "users"),
    conversions: n(row, ctx, "conversions"),
    revenue: n(row, ctx, "revenue"),
    ...extras(row, ctx),
  };
}

/* ------------------------- Provenance label ------------------------- */

function detectFormat(shape: Shape, cm: ColumnMap, t: Table): EvidenceFormat {
  if (shape === "backlinks") return "backlinks";
  if (shape === "content_gap") return "content_gap";
  if (shape === "dimensions") {
    if (cm.sessions || cm.users || cm.channelGroup || cm.sourceMedium) return "ga4";
    return cm.clicks && cm.impressions ? "gsc" : "dimensions";
  }
  if (shape === "queries") return "gsc";
  if (shape === "pages") {
    if (cm.sessions || cm.users || cm.views || cm.engagementRate) return "ga4";
    return "gsc_pages";
  }
  // keywords — tell the two research tools apart by their signature columns
  const keys = new Set(t.keys.map((k) => k.replace(/#\d+$/, "")));
  const semrushish = ["competitive density", "keyword difficulty", "search volume", "intent", "results", "com"];
  const ahrefsish = ["kd", "volume", "parent topic", "serp features", "traffic value", "dr"];
  const semrushHits = semrushish.filter((k) => keys.has(k)).length;
  const ahrefsHits = ahrefsish.filter((k) => keys.has(k)).length;
  if (semrushHits > ahrefsHits) return "semrush";
  if (ahrefsHits > 0) return "ahrefs";
  return "unknown";
}

/* =============================== Merge ============================== */

/**
 * Merges several parsed files into one snapshot, de-duplicating rows so the same
 * query appearing in two exports isn't double-counted by the opportunity scan.
 */
export function mergeEvidence(parts: ParsedEvidence[]): ParsedEvidence {
  const data: NormalizedEvidence = {};
  const rowCounts: Record<string, number> = {};
  const warnings = [...new Set(parts.flatMap((p) => p.warnings))];
  const headers = [...new Set(parts.flatMap((p) => p.headers))];

  const collect = <T>(
    pick: (d: NormalizedEvidence) => T[] | undefined,
    key: (row: T) => string,
  ): T[] => dedupe(parts.flatMap((p) => pick(p.data) ?? []), key);

  const queries = collect(
    (d) => d.queries,
    (q) => [q.query.toLowerCase(), q.date ?? "", q.country ?? "", q.device ?? "", q.page ?? ""].join("|"),
  );
  const pages = collect((d) => d.pages, (p) => p.url.toLowerCase());
  const keywords = collect(
    (d) => d.keywords,
    (k) => `${k.keyword.toLowerCase()}|${k.url ?? ""}|${k.country ?? ""}`,
  );
  const contentGap = collect(
    (d) => d.contentGap,
    (c) => `${c.keyword.toLowerCase()}|${c.competitor.toLowerCase()}`,
  );
  const backlinks = collect(
    (d) => d.backlinks,
    (b) => `${b.sourceUrl.toLowerCase()}|${b.targetUrl ?? ""}|${b.anchor ?? ""}`,
  );
  const dimensions = collect(
    (d) => d.dimensions,
    (d) => `${d.dimension.toLowerCase()}|${d.value.toLowerCase()}`,
  );
  const unmapped = parts.flatMap((p) => p.data.unmapped ?? []);

  const assign = <T>(name: keyof NormalizedEvidence, rows: T[]) => {
    if (!rows.length) return;
    (data[name] as unknown as T[]) = rows;
    rowCounts[name as string] = rows.length;
  };

  assign("queries", queries);
  assign("pages", pages);
  assign("keywords", keywords);
  assign("contentGap", contentGap);
  assign("backlinks", backlinks);
  assign("dimensions", dimensions);
  assign("unmapped", unmapped);
  if (unmapped.length) {
    rowCounts.unmapped = unmapped.reduce((a, u) => a + u.rows.length, 0);
  }

  const formats = [...new Set(parts.map((p) => p.format).filter((f) => f !== "unknown"))];
  const format: EvidenceFormat =
    formats.length === 1 ? formats[0] : formats.length > 1 ? "mixed" : "unknown";

  return { data, rowCounts, format, headers, warnings };
}

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
