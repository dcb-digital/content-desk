/**
 * Parses CSV exports from GSC, Ahrefs, SEMrush into NormalizedEvidence.
 * Best-effort: unknown columns are ignored, missing columns produce undefined values.
 */
import type { NormalizedEvidence } from "@/db/schema";

type Row = Record<string, string>;

function parseCSV(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  // Find the header line (skip GSC preamble lines that don't contain commas)
  let headerIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(",") || lines[i].includes("\t")) {
      headerIdx = i;
      break;
    }
  }
  const sep = lines[headerIdx].includes("\t") ? "\t" : ",";
  const headers = lines[headerIdx].split(sep).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const rows: Row[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Row = {};
    headers.forEach((h, j) => { row[h] = values[j] ?? ""; });
    rows.push(row);
  }
  return rows;
}

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = parseFloat(v.replace(/[%,]/g, ""));
  return isNaN(n) ? undefined : n;
}

function detectFormat(rows: Row[]): "gsc" | "ahrefs" | "semrush" | "unknown" {
  if (!rows.length) return "unknown";
  const keys = Object.keys(rows[0]);
  if (keys.some((k) => k.includes("query"))) return "gsc";
  if (keys.some((k) => k.includes("keyword") && k.includes("difficulty"))) return "ahrefs";
  if (keys.some((k) => k === "keyword" || k === "search volume")) return "semrush";
  return "unknown";
}

export function parseEvidence(csvText: string): {
  data: NormalizedEvidence;
  rowCounts: Record<string, number>;
  format: string;
} {
  const rows = parseCSV(csvText);
  const format = detectFormat(rows);

  if (format === "gsc") {
    const queries = rows.map((r) => ({
      query: r["query"] ?? r["top queries"] ?? "",
      clicks: num(r["clicks"]) ?? 0,
      impressions: num(r["impressions"]) ?? 0,
      ctr: num(r["ctr"]) ?? 0,
      position: num(r["position"]) ?? 0,
    })).filter((q) => q.query);

    return {
      data: { queries },
      rowCounts: { queries: queries.length },
      format: "gsc",
    };
  }

  if (format === "ahrefs") {
    const keywords = rows.map((r) => ({
      keyword: r["keyword"] ?? r["query"] ?? "",
      volume: num(r["volume"] ?? r["search volume"]),
      position: num(r["position"] ?? r["current position"]),
      url: r["url"] ?? r["current url"],
      difficulty: num(r["kd"] ?? r["keyword difficulty"]),
    })).filter((k) => k.keyword);

    return {
      data: { keywords },
      rowCounts: { keywords: keywords.length },
      format: "ahrefs",
    };
  }

  if (format === "semrush") {
    const keywords = rows.map((r) => ({
      keyword: r["keyword"] ?? "",
      volume: num(r["search volume"] ?? r["volume"]),
      position: num(r["position"] ?? r["pos."]),
      url: r["url"],
      difficulty: num(r["keyword difficulty"] ?? r["kd"]),
    })).filter((k) => k.keyword);

    return {
      data: { keywords },
      rowCounts: { keywords: keywords.length },
      format: "semrush",
    };
  }

  // Unknown: store as empty but don't crash
  return { data: {}, rowCounts: {}, format: "unknown" };
}
