/**
 * Renders every collection present in a snapshot. Columns are conditional — a
 * column only appears if at least one row populated it — and any column the
 * parser preserved in `extra` is surfaced too, so the UI shows what was captured
 * rather than a fixed guess.
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

const MAX_ROWS = 500;
const MAX_EXTRA_COLS = 8;

type Col<T> = {
  header: string;
  right?: boolean;
  render: (row: T) => React.ReactNode;
};

/* ----------------------------- formatting ---------------------------- */

const DASH = "–";

function int(v?: number) {
  return v === undefined ? DASH : v.toLocaleString("en-AU");
}
function dec(v?: number, dp = 1) {
  return v === undefined ? DASH : v.toFixed(dp);
}
function pct(v?: number) {
  return v === undefined ? DASH : `${(v * 100).toFixed(1)}%`;
}
function money(v?: number) {
  return v === undefined
    ? DASH
    : `$${v.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
}
function secs(v?: number) {
  if (v === undefined) return DASH;
  const m = Math.floor(v / 60);
  const s = Math.round(v % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}
function str(v?: string) {
  return v && v.trim() !== "" ? v : DASH;
}
function bool(v?: boolean) {
  return v === undefined ? DASH : v ? "yes" : "no";
}

function has<T>(rows: T[], get: (row: T) => unknown): boolean {
  return rows.some((r) => {
    const v = get(r);
    return v !== undefined && v !== null && v !== "";
  });
}

/** Builds columns for whatever the parser stashed in `extra`, most common first. */
function extraColumns<T extends { extra?: Record<string, string> }>(
  rows: T[],
): { cols: Col<T>[]; hidden: string[] } {
  const freq = new Map<string, number>();
  for (const row of rows) {
    for (const key of Object.keys(row.extra ?? {})) {
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return {
    cols: sorted.slice(0, MAX_EXTRA_COLS).map((key) => ({
      header: key,
      render: (row: T) => str(row.extra?.[key]),
    })),
    hidden: sorted.slice(MAX_EXTRA_COLS),
  };
}

/* ------------------------------- table ------------------------------- */

function Section<T>({
  title,
  count,
  rows,
  cols,
  hidden = [],
  rowClass,
}: {
  title: string;
  count: number;
  rows: T[];
  cols: Col<T>[];
  hidden?: string[];
  rowClass?: (row: T) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">
          {title}{" "}
          <span className="text-muted-foreground font-normal">
            {count.toLocaleString("en-AU")} rows
          </span>
        </h3>
        {hidden.length > 0 && (
          <p className="text-xs text-muted-foreground">
            +{hidden.length} more column{hidden.length === 1 ? "" : "s"} stored ({hidden.join(", ")})
          </p>
        )}
      </div>
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {cols.map((c) => (
                <th
                  key={c.header}
                  className={`px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap ${
                    c.right ? "text-right" : "text-left"
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr key={i} className={`hover:bg-muted/20 ${rowClass?.(row) ?? ""}`}>
                {cols.map((c) => (
                  <td
                    key={c.header}
                    className={`px-3 py-2 text-xs max-w-[280px] truncate ${
                      c.right ? "text-right font-mono text-muted-foreground" : ""
                    }`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {count > rows.length && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {rows.length} of {count.toLocaleString("en-AU")} rows — the full set is stored
          and available to generation.
        </p>
      )}
    </div>
  );
}

/* ---------------------------- collections ---------------------------- */

function Queries({ rows }: { rows: EvidenceQueryRow[] }) {
  const shown = rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_ROWS);
  const { cols: extra, hidden } = extraColumns(rows);

  const candidates: (Col<EvidenceQueryRow> | false)[] = [
    { header: "Query", render: (r) => r.query },
    { header: "Pos.", right: true, render: (r) => dec(r.position) },
    has(rows, (r) => r.positionPrev) && {
      header: "Pos. prev",
      right: true,
      render: (r) => dec(r.positionPrev),
    },
    { header: "Clicks", right: true, render: (r) => int(r.clicks) },
    has(rows, (r) => r.clicksPrev) && {
      header: "Clicks prev",
      right: true,
      render: (r) => int(r.clicksPrev),
    },
    { header: "Impressions", right: true, render: (r) => int(r.impressions) },
    has(rows, (r) => r.impressionsPrev) && {
      header: "Impr. prev",
      right: true,
      render: (r) => int(r.impressionsPrev),
    },
    { header: "CTR", right: true, render: (r) => pct(r.ctr) },
    has(rows, (r) => r.page) && { header: "Page", render: (r) => str(r.page) },
    has(rows, (r) => r.country) && { header: "Country", render: (r) => str(r.country) },
    has(rows, (r) => r.device) && { header: "Device", render: (r) => str(r.device) },
    has(rows, (r) => r.date) && { header: "Date", render: (r) => str(r.date) },
    has(rows, (r) => r.searchAppearance) && {
      header: "Appearance",
      render: (r) => str(r.searchAppearance),
    },
    ...extra,
  ];
  const cols = candidates.filter(Boolean) as Col<EvidenceQueryRow>[];

  return (
    <Section
      title="Queries"
      count={rows.length}
      rows={shown}
      cols={cols}
      hidden={hidden}
      rowClass={(r) =>
        r.position >= 4 && r.position <= 20 && r.impressions >= 20 ? "bg-yellow-500/5" : ""
      }
    />
  );
}

function Pages({ rows }: { rows: EvidencePageRow[] }) {
  const shown = rows
    .slice()
    .sort((a, b) => (b.clicks ?? b.sessions ?? b.views ?? 0) - (a.clicks ?? a.sessions ?? a.views ?? 0))
    .slice(0, MAX_ROWS);
  const { cols: extra, hidden } = extraColumns(rows);

  const candidates: (Col<EvidencePageRow> | false)[] = [
    { header: "Page", render: (r) => r.url },
    has(rows, (r) => r.title) && { header: "Title", render: (r) => str(r.title) },
    has(rows, (r) => r.clicks) && { header: "Clicks", right: true, render: (r) => int(r.clicks) },
    has(rows, (r) => r.impressions) && {
      header: "Impressions",
      right: true,
      render: (r) => int(r.impressions),
    },
    has(rows, (r) => r.ctr) && { header: "CTR", right: true, render: (r) => pct(r.ctr) },
    has(rows, (r) => r.position) && { header: "Pos.", right: true, render: (r) => dec(r.position) },
    has(rows, (r) => r.sessions) && { header: "Sessions", right: true, render: (r) => int(r.sessions) },
    has(rows, (r) => r.users) && { header: "Users", right: true, render: (r) => int(r.users) },
    has(rows, (r) => r.newUsers) && { header: "New users", right: true, render: (r) => int(r.newUsers) },
    has(rows, (r) => r.views) && { header: "Views", right: true, render: (r) => int(r.views) },
    has(rows, (r) => r.engagementRate) && {
      header: "Engagement",
      right: true,
      render: (r) => pct(r.engagementRate),
    },
    has(rows, (r) => r.bounceRate) && {
      header: "Bounce",
      right: true,
      render: (r) => pct(r.bounceRate),
    },
    has(rows, (r) => r.avgEngagementTimeSec) && {
      header: "Avg. time",
      right: true,
      render: (r) => secs(r.avgEngagementTimeSec),
    },
    has(rows, (r) => r.eventCount) && { header: "Events", right: true, render: (r) => int(r.eventCount) },
    has(rows, (r) => r.conversions) && {
      header: "Conversions",
      right: true,
      render: (r) => int(r.conversions),
    },
    has(rows, (r) => r.revenue) && { header: "Revenue", right: true, render: (r) => money(r.revenue) },
    ...extra,
  ];
  const cols = candidates.filter(Boolean) as Col<EvidencePageRow>[];

  return <Section title="Pages" count={rows.length} rows={shown} cols={cols} hidden={hidden} />;
}

function Keywords({ rows }: { rows: EvidenceKeywordRow[] }) {
  const shown = rows
    .slice()
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .slice(0, MAX_ROWS);
  const { cols: extra, hidden } = extraColumns(rows);

  const candidates: (Col<EvidenceKeywordRow> | false)[] = [
    { header: "Keyword", render: (r) => r.keyword },
    has(rows, (r) => r.position) && { header: "Pos.", right: true, render: (r) => int(r.position) },
    has(rows, (r) => r.previousPosition) && {
      header: "Prev. pos.",
      right: true,
      render: (r) => int(r.previousPosition),
    },
    has(rows, (r) => r.volume) && { header: "Volume", right: true, render: (r) => int(r.volume) },
    has(rows, (r) => r.difficulty) && { header: "KD", right: true, render: (r) => int(r.difficulty) },
    has(rows, (r) => r.cpc) && { header: "CPC", right: true, render: (r) => money(r.cpc) },
    has(rows, (r) => r.traffic) && { header: "Traffic", right: true, render: (r) => int(r.traffic) },
    has(rows, (r) => r.trafficValue) && {
      header: "Traffic value",
      right: true,
      render: (r) => money(r.trafficValue),
    },
    has(rows, (r) => r.trafficPercent) && {
      header: "Traffic %",
      right: true,
      render: (r) => pct(r.trafficPercent),
    },
    has(rows, (r) => r.intent) && { header: "Intent", render: (r) => str(r.intent) },
    has(rows, (r) => r.parentTopic) && {
      header: "Parent topic",
      render: (r) => str(r.parentTopic),
    },
    has(rows, (r) => r.serpFeatures) && {
      header: "SERP features",
      render: (r) => str(r.serpFeatures),
    },
    has(rows, (r) => r.competitiveDensity) && {
      header: "Density",
      right: true,
      render: (r) => dec(r.competitiveDensity, 2),
    },
    has(rows, (r) => r.results) && { header: "Results", right: true, render: (r) => int(r.results) },
    has(rows, (r) => r.country) && { header: "Country", render: (r) => str(r.country) },
    has(rows, (r) => r.url) && { header: "URL", render: (r) => str(r.url) },
    ...extra,
  ];
  const cols = candidates.filter(Boolean) as Col<EvidenceKeywordRow>[];

  return <Section title="Keywords" count={rows.length} rows={shown} cols={cols} hidden={hidden} />;
}

function ContentGap({ rows }: { rows: EvidenceContentGapRow[] }) {
  const shown = rows
    .slice()
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, MAX_ROWS);
  const { cols: extra, hidden } = extraColumns(rows);

  const candidates: (Col<EvidenceContentGapRow> | false)[] = [
    { header: "Keyword", render: (r) => r.keyword },
    { header: "Competitor", render: (r) => r.competitor },
    { header: "Their pos.", right: true, render: (r) => int(r.competitorPosition) },
    has(rows, (r) => r.ourPosition) && {
      header: "Our pos.",
      right: true,
      render: (r) => int(r.ourPosition),
    },
    has(rows, (r) => r.volume) && {
      header: "Volume",
      right: true,
      render: (r) => int(r.volume),
    },
    ...extra,
  ];
  const cols = candidates.filter(Boolean) as Col<EvidenceContentGapRow>[];

  return <Section title="Content gap" count={rows.length} rows={shown} cols={cols} hidden={hidden} />;
}

function Backlinks({ rows }: { rows: EvidenceBacklinkRow[] }) {
  const shown = rows
    .slice()
    .sort((a, b) => (b.domainRating ?? b.authorityScore ?? 0) - (a.domainRating ?? a.authorityScore ?? 0))
    .slice(0, MAX_ROWS);
  const { cols: extra, hidden } = extraColumns(rows);

  const candidates: (Col<EvidenceBacklinkRow> | false)[] = [
    { header: "Source", render: (r) => r.sourceUrl },
    has(rows, (r) => r.sourceTitle) && {
      header: "Title",
      render: (r) => str(r.sourceTitle),
    },
    has(rows, (r) => r.targetUrl) && { header: "Target", render: (r) => str(r.targetUrl) },
    has(rows, (r) => r.anchor) && { header: "Anchor", render: (r) => str(r.anchor) },
    has(rows, (r) => r.domainRating) && {
      header: "DR",
      right: true,
      render: (r) => int(r.domainRating),
    },
    has(rows, (r) => r.authorityScore) && {
      header: "AS",
      right: true,
      render: (r) => int(r.authorityScore),
    },
    has(rows, (r) => r.nofollow) && {
      header: "Nofollow",
      right: true,
      render: (r) => bool(r.nofollow),
    },
    has(rows, (r) => r.firstSeen) && { header: "First seen", render: (r) => str(r.firstSeen) },
    ...extra,
  ];
  const cols = candidates.filter(Boolean) as Col<EvidenceBacklinkRow>[];

  return <Section title="Backlinks" count={rows.length} rows={shown} cols={cols} hidden={hidden} />;
}

function Dimensions({ rows }: { rows: EvidenceDimensionRow[] }) {
  const shown = rows
    .slice()
    .sort((a, b) => (b.clicks ?? b.sessions ?? 0) - (a.clicks ?? a.sessions ?? 0))
    .slice(0, MAX_ROWS);
  const { cols: extra, hidden } = extraColumns(rows);
  const dimensionName = rows[0]?.dimension ?? "Dimension";

  const candidates: (Col<EvidenceDimensionRow> | false)[] = [
    { header: dimensionName, render: (r) => r.value },
    has(rows, (r) => r.clicks) && { header: "Clicks", right: true, render: (r) => int(r.clicks) },
    has(rows, (r) => r.impressions) && {
      header: "Impressions",
      right: true,
      render: (r) => int(r.impressions),
    },
    has(rows, (r) => r.ctr) && { header: "CTR", right: true, render: (r) => pct(r.ctr) },
    has(rows, (r) => r.position) && {
      header: "Pos.",
      right: true,
      render: (r) => dec(r.position),
    },
    has(rows, (r) => r.sessions) && {
      header: "Sessions",
      right: true,
      render: (r) => int(r.sessions),
    },
    has(rows, (r) => r.users) && { header: "Users", right: true, render: (r) => int(r.users) },
    has(rows, (r) => r.conversions) && {
      header: "Conversions",
      right: true,
      render: (r) => int(r.conversions),
    },
    has(rows, (r) => r.revenue) && {
      header: "Revenue",
      right: true,
      render: (r) => money(r.revenue),
    },
    ...extra,
  ];
  const cols = candidates.filter(Boolean) as Col<EvidenceDimensionRow>[];

  return <Section title="Breakdown" count={rows.length} rows={shown} cols={cols} hidden={hidden} />;
}

function Unmapped({ table }: { table: EvidenceUnmappedTable }) {
  const shown = table.rows.slice(0, MAX_ROWS);
  const cols: Col<Record<string, string>>[] = table.headers.map((h) => ({
    header: h,
    render: (row) => str(row[h]),
  }));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {table.label ? `${table.label} — ` : ""}layout not recognised, so every column was stored
        verbatim and is still passed to generation.
      </p>
      <Section title="Unrecognised export" count={table.rows.length} rows={shown} cols={cols} />
    </div>
  );
}

/* ------------------------------ entry ------------------------------- */

export function SnapshotTables({ data }: { data: NormalizedEvidence }) {
  const sections = [
    data.queries?.length ? <Queries key="q" rows={data.queries} /> : null,
    data.pages?.length ? <Pages key="p" rows={data.pages} /> : null,
    data.keywords?.length ? <Keywords key="k" rows={data.keywords} /> : null,
    data.contentGap?.length ? <ContentGap key="cg" rows={data.contentGap} /> : null,
    data.backlinks?.length ? <Backlinks key="bl" rows={data.backlinks} /> : null,
    data.dimensions?.length ? <Dimensions key="d" rows={data.dimensions} /> : null,
    ...(data.unmapped ?? []).map((t, i) => <Unmapped key={`u${i}`} table={t} />),
  ].filter(Boolean);

  if (!sections.length) {
    return <p className="text-sm text-muted-foreground">No row data found in this snapshot.</p>;
  }

  return <div className="space-y-6">{sections}</div>;
}
