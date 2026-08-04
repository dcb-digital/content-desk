import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScanOpportunitiesButton } from "./scan-opportunities-button";

type Props = {
  params: Promise<{ clientId: string; sourceId: string }>;
  searchParams: Promise<{ snap?: string }>;
};

export default async function EvidenceSourcePage({ params, searchParams }: Props) {
  const { clientId, sourceId } = await params;
  const { snap } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: source } = await supabase
    .from("evidence_sources")
    .select("id, label, provider, staff_notes")
    .eq("id", sourceId)
    .single();

  if (!source) notFound();

  const { data: snapshots } = await supabase
    .from("evidence_snapshots")
    .select("id, period_start, period_end, data, row_counts, created_at")
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false });

  const allSnaps = snapshots ?? [];
  const activeSnap = snap
    ? allSnaps.find((s) => s.id === snap) ?? allSnaps[0]
    : allSnaps[0];

  type Query = { query: string; clicks: number; impressions: number; ctr: number; position: number };
  type Keyword = { keyword: string; volume?: number; position?: number; url?: string; difficulty?: number };

  const data = activeSnap?.data as { queries?: Query[]; keywords?: Keyword[] } | null;
  const queries: Query[] = data?.queries ?? [];
  const keywords: Keyword[] = data?.keywords ?? [];
  const isGSC = queries.length > 0;

  // Striking distance: position 4–20 with >20 impressions
  const strikingDistance = queries.filter(
    (q) => q.position >= 4 && q.position <= 20 && q.impressions >= 20
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/clients/${clientId}/evidence`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">{source.label}</h2>
          <p className="text-xs text-muted-foreground">
            {source.provider.toUpperCase()}
            {activeSnap?.period_start && activeSnap?.period_end && (
              <> · {activeSnap.period_start} → {activeSnap.period_end}</>
            )}
          </p>
        </div>
        {strikingDistance.length > 0 && activeSnap && (
          <ScanOpportunitiesButton
            clientId={clientId}
            queries={strikingDistance}
            snapshotId={activeSnap.id}
          />
        )}
      </div>

      {/* Snapshot picker */}
      {allSnaps.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {allSnaps.map((s) => (
            <Link
              key={s.id}
              href={`?snap=${s.id}`}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                s.id === activeSnap?.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              {s.period_start ?? new Date(s.created_at).toLocaleDateString("en-AU")}
            </Link>
          ))}
        </div>
      )}

      {!activeSnap && (
        <p className="text-sm text-muted-foreground">No snapshot data available for this source.</p>
      )}

      {/* GSC queries table */}
      {isGSC && (
        <div className="space-y-2">
          {strikingDistance.length > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400">
              <strong>{strikingDistance.length}</strong> striking distance queries (position 4–20) — click &quot;Scan opportunities&quot; to add them.
            </div>
          )}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Query</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Pos.</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Clicks</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Impressions</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queries
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .slice(0, 500)
                  .map((q, i) => {
                    const isStrking = q.position >= 4 && q.position <= 20 && q.impressions >= 20;
                    return (
                      <tr key={i} className={`hover:bg-muted/20 ${isStrking ? "bg-yellow-500/5" : ""}`}>
                        <td className="px-4 py-2 text-xs max-w-[280px] truncate">{q.query}</td>
                        <td className="px-4 py-2 text-xs text-right font-mono">
                          <span className={isStrking ? "text-yellow-600 dark:text-yellow-400 font-medium" : ""}>
                            {q.position.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-right text-muted-foreground">{q.clicks.toLocaleString()}</td>
                        <td className="px-4 py-2 text-xs text-right text-muted-foreground">{q.impressions.toLocaleString()}</td>
                        <td className="px-4 py-2 text-xs text-right text-muted-foreground">{(q.ctr * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {queries.length > 500 && (
            <p className="text-xs text-muted-foreground text-center">Showing top 500 of {queries.length.toLocaleString()} rows</p>
          )}
        </div>
      )}

      {/* Keywords table (Ahrefs / SEMrush) */}
      {!isGSC && keywords.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Keyword</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Pos.</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Volume</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">KD</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords
                .slice()
                .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                .slice(0, 500)
                .map((k, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs">{k.keyword}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono">{k.position ?? "–"}</td>
                    <td className="px-4 py-2 text-xs text-right text-muted-foreground">
                      {k.volume?.toLocaleString() ?? "–"}
                    </td>
                    <td className="px-4 py-2 text-xs text-right text-muted-foreground">{k.difficulty ?? "–"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[160px]">
                      {k.url ?? "–"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!isGSC && keywords.length === 0 && activeSnap && (
        <p className="text-sm text-muted-foreground">No row data found in this snapshot.</p>
      )}
    </div>
  );
}
