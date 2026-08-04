/**
 * Turns a stored snapshot into markdown tables for prompt assembly (§6.6 step 5).
 *
 * The snapshot holds everything the export contained; a prompt can't. So this
 * excerpts the densest signal per collection and **states what it left out** —
 * both the rows beyond the cap and any column not included. Nothing is dropped
 * silently, and every block carries its [evidence:<id>] ref so generated copy
 * can cite it (iron rule 2).
 */
import type {
  EvidenceBacklinkRow,
  EvidenceContentGapRow,
  EvidenceDimensionRow,
  EvidenceKeywordRow,
  EvidencePageRow,
  EvidenceQueryRow,
  NormalizedEvidence,
} from "@/db/schema";

/** Rows excerpted per collection — keeps prompts affordable. */
export const EXCERPT_LIMITS = {
  queries: 40,
  pages: 25,
  keywords: 40,
  contentGap: 30,
  backlinks: 20,
  dimensions: 25,
  unmapped: 15,
} as const;

/** Preserved-but-untyped columns to include per table before we start naming omissions. */
const MAX_EXTRA_COLS = 4;
/** Column cap for verbatim unrecognised tables. */
const MAX_UNMAPPED_COLS = 12;

export type SnapshotMeta = {
  id: string;
  provider: string;
  periodStart: string | null;
  periodEnd: string | null;
};

type Cell = string | number | undefined;
type Col<T> = { header: string; get: (row: T) => Cell };
type WithExtra = { extra?: Record<string, string> };

const has = (v: Cell) => v !== undefined && v !== null && v !== "";

function cell(v: Cell): string {
  if (!has(v)) return "n/a";
  return String(v).replaceAll("|", "\\|").replaceAll("\n", " ");
}

const int = (v?: number) => (v === undefined ? undefined : Math.round(v).toString());
const dec = (v?: number, dp = 1) => (v === undefined ? undefined : v.toFixed(dp));
const pctOf = (v?: number) => (v === undefined ? undefined : `${(v * 100).toFixed(1)}%`);

type TableSpec<T> = {
  title: string;
  rows: T[];
  limit: number;
  /** how the excerpt was chosen, named in the omission note */
  sortedBy: string;
  sort?: (a: T, b: T) => number;
  cols: Col<T>[];
};

function renderTable<T extends WithExtra>(
  spec: TableSpec<T>,
): { block: string; notes: string[] } | null {
  const all = spec.rows;
  if (!all.length) return null;

  const ordered = spec.sort ? all.slice().sort(spec.sort) : all.slice();
  const rows = ordered.slice(0, spec.limit);
  const notes: string[] = [];

  // Only keep columns that at least one excerpted row populated
  const cols = spec.cols.filter((c) => rows.some((r) => has(c.get(r))));

  // Surface preserved-but-untyped columns, most populated first
  const freq = new Map<string, number>();
  for (const row of rows) {
    for (const key of Object.keys(row.extra ?? {})) {
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }
  const extraKeys = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  for (const key of extraKeys.slice(0, MAX_EXTRA_COLS)) {
    cols.push({ header: key, get: (r) => r.extra?.[key] });
  }
  const omittedCols = extraKeys.slice(MAX_EXTRA_COLS);

  if (!cols.length) return null;

  const header = `| ${cols.map((c) => c.header).join(" | ")} |`;
  const divider = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${cols.map((c) => cell(c.get(r))).join(" | ")} |`);

  if (all.length > rows.length) {
    notes.push(
      `${spec.title}: top ${rows.length} of ${all.length.toLocaleString("en-AU")} rows by ${spec.sortedBy}`,
    );
  }
  if (omittedCols.length) {
    notes.push(`${spec.title}: columns stored but not excerpted — ${omittedCols.join(", ")}`);
  }

  return {
    block: `**${spec.title}**\n${[header, divider, ...body].join("\n")}`,
    notes,
  };
}

/** Markdown excerpt of one snapshot, or null when it holds no rows. */
export function excerptSnapshot(data: NormalizedEvidence, meta: SnapshotMeta): string | null {
  const results: ({ block: string; notes: string[] } | null)[] = [];

  results.push(
    renderTable<EvidenceQueryRow>({
      title: "Queries",
      rows: data.queries ?? [],
      limit: EXCERPT_LIMITS.queries,
      sortedBy: "impressions",
      sort: (a, b) => b.impressions - a.impressions,
      cols: [
        { header: "query", get: (r) => r.query },
        { header: "clicks", get: (r) => int(r.clicks) },
        { header: "impressions", get: (r) => int(r.impressions) },
        { header: "ctr", get: (r) => pctOf(r.ctr) },
        { header: "position", get: (r) => dec(r.position) },
        { header: "clicks prev", get: (r) => int(r.clicksPrev) },
        { header: "impressions prev", get: (r) => int(r.impressionsPrev) },
        { header: "ctr prev", get: (r) => pctOf(r.ctrPrev) },
        { header: "position prev", get: (r) => dec(r.positionPrev) },
        { header: "page", get: (r) => r.page },
        { header: "country", get: (r) => r.country },
        { header: "device", get: (r) => r.device },
        { header: "date", get: (r) => r.date },
        { header: "appearance", get: (r) => r.searchAppearance },
      ],
    }),
  );

  results.push(
    renderTable<EvidencePageRow>({
      title: "Pages",
      rows: data.pages ?? [],
      limit: EXCERPT_LIMITS.pages,
      sortedBy: "clicks or sessions",
      sort: (a, b) =>
        (b.clicks ?? b.sessions ?? b.views ?? 0) - (a.clicks ?? a.sessions ?? a.views ?? 0),
      cols: [
        { header: "page", get: (r) => r.url },
        { header: "title", get: (r) => r.title },
        { header: "clicks", get: (r) => int(r.clicks) },
        { header: "impressions", get: (r) => int(r.impressions) },
        { header: "ctr", get: (r) => pctOf(r.ctr) },
        { header: "position", get: (r) => dec(r.position) },
        { header: "sessions", get: (r) => int(r.sessions) },
        { header: "users", get: (r) => int(r.users) },
        { header: "new users", get: (r) => int(r.newUsers) },
        { header: "views", get: (r) => int(r.views) },
        { header: "engagement rate", get: (r) => pctOf(r.engagementRate) },
        { header: "bounce rate", get: (r) => pctOf(r.bounceRate) },
        { header: "avg engagement s", get: (r) => int(r.avgEngagementTimeSec) },
        { header: "events", get: (r) => int(r.eventCount) },
        { header: "conversions", get: (r) => int(r.conversions) },
        { header: "revenue", get: (r) => dec(r.revenue, 2) },
      ],
    }),
  );

  results.push(
    renderTable<EvidenceKeywordRow>({
      title: "Keywords",
      rows: data.keywords ?? [],
      limit: EXCERPT_LIMITS.keywords,
      sortedBy: "volume",
      sort: (a, b) => (b.volume ?? 0) - (a.volume ?? 0),
      cols: [
        { header: "keyword", get: (r) => r.keyword },
        { header: "volume", get: (r) => int(r.volume) },
        { header: "position", get: (r) => int(r.position) },
        { header: "previous position", get: (r) => int(r.previousPosition) },
        { header: "difficulty", get: (r) => int(r.difficulty) },
        { header: "cpc", get: (r) => dec(r.cpc, 2) },
        { header: "traffic", get: (r) => int(r.traffic) },
        { header: "traffic value", get: (r) => dec(r.trafficValue, 2) },
        { header: "traffic %", get: (r) => pctOf(r.trafficPercent) },
        { header: "intent", get: (r) => r.intent },
        { header: "parent topic", get: (r) => r.parentTopic },
        { header: "serp features", get: (r) => r.serpFeatures },
        { header: "competitive density", get: (r) => dec(r.competitiveDensity, 2) },
        { header: "results", get: (r) => int(r.results) },
        { header: "country", get: (r) => r.country },
        { header: "url", get: (r) => r.url },
      ],
    }),
  );

  results.push(
    renderTable<EvidenceContentGapRow>({
      title: "Content gap",
      rows: data.contentGap ?? [],
      limit: EXCERPT_LIMITS.contentGap,
      sortedBy: "volume",
      sort: (a, b) => (b.volume ?? 0) - (a.volume ?? 0),
      cols: [
        { header: "keyword", get: (r) => r.keyword },
        { header: "competitor", get: (r) => r.competitor },
        { header: "competitor position", get: (r) => int(r.competitorPosition) },
        { header: "our position", get: (r) => int(r.ourPosition) },
        { header: "volume", get: (r) => int(r.volume) },
      ],
    }),
  );

  results.push(
    renderTable<EvidenceBacklinkRow>({
      title: "Backlinks",
      rows: data.backlinks ?? [],
      limit: EXCERPT_LIMITS.backlinks,
      sortedBy: "domain rating or authority score",
      sort: (a, b) =>
        (b.domainRating ?? b.authorityScore ?? 0) - (a.domainRating ?? a.authorityScore ?? 0),
      cols: [
        { header: "source", get: (r) => r.sourceUrl },
        { header: "source title", get: (r) => r.sourceTitle },
        { header: "target", get: (r) => r.targetUrl },
        { header: "anchor", get: (r) => r.anchor },
        { header: "domain rating", get: (r) => int(r.domainRating) },
        { header: "authority score", get: (r) => int(r.authorityScore) },
        { header: "nofollow", get: (r) => (r.nofollow === undefined ? undefined : String(r.nofollow)) },
        { header: "first seen", get: (r) => r.firstSeen },
      ],
    }),
  );

  results.push(
    renderTable<EvidenceDimensionRow>({
      title: "Breakdown",
      rows: data.dimensions ?? [],
      limit: EXCERPT_LIMITS.dimensions,
      sortedBy: "clicks or sessions",
      sort: (a, b) => (b.clicks ?? b.sessions ?? 0) - (a.clicks ?? a.sessions ?? 0),
      cols: [
        { header: "dimension", get: (r) => r.dimension },
        { header: "value", get: (r) => r.value },
        { header: "clicks", get: (r) => int(r.clicks) },
        { header: "impressions", get: (r) => int(r.impressions) },
        { header: "ctr", get: (r) => pctOf(r.ctr) },
        { header: "position", get: (r) => dec(r.position) },
        { header: "sessions", get: (r) => int(r.sessions) },
        { header: "users", get: (r) => int(r.users) },
        { header: "conversions", get: (r) => int(r.conversions) },
        { header: "revenue", get: (r) => dec(r.revenue, 2) },
      ],
    }),
  );

  // Unrecognised exports: pass the raw columns through so the model can still use them
  for (const table of data.unmapped ?? []) {
    const cols = table.headers.slice(0, MAX_UNMAPPED_COLS);
    results.push(
      renderTable<Record<string, string> & WithExtra>({
        title: table.label ? `Unrecognised export (${table.label})` : "Unrecognised export",
        rows: table.rows,
        limit: EXCERPT_LIMITS.unmapped,
        sortedBy: "file order",
        cols: cols.map((h) => ({ header: h, get: (r) => r[h] })),
      }),
    );
    if (table.headers.length > cols.length) {
      const last = results[results.length - 1];
      last?.notes.push(
        `Unrecognised export: columns stored but not excerpted — ${table.headers.slice(MAX_UNMAPPED_COLS).join(", ")}`,
      );
    }
  }

  const present = results.filter((r): r is { block: string; notes: string[] } => r !== null);
  if (!present.length) return null;

  const period =
    meta.periodStart && meta.periodEnd
      ? `${meta.periodStart} → ${meta.periodEnd}`
      : "period not recorded";
  const heading = `### ${meta.provider.toUpperCase()} · ${period} [evidence:${meta.id}]`;
  const notes = present.flatMap((p) => p.notes);
  const footer = notes.length ? `\n\n_Excerpt notes: ${notes.join("; ")}._` : "";

  return `${heading}\n${present.map((p) => p.block).join("\n\n")}${footer}`;
}
