import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { AddSourceForm } from "./add-source-form";
import { DeleteSourceButton } from "./delete-source-button";

const PROVIDER_LABELS: Record<string, string> = {
  gsc: "Google Search Console",
  ahrefs: "Ahrefs",
  semrush: "SEMrush",
  ga4: "Google Analytics 4",
  file: "Manual / Other",
};

type Props = { params: Promise<{ clientId: string }> };

export default async function EvidencePage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sources } = await supabase
    .from("evidence_sources")
    .select("id, label, provider, staff_notes, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const sourceIds = (sources ?? []).map((s) => s.id);
  const { data: snapshots } = sourceIds.length
    ? await supabase
        .from("evidence_snapshots")
        .select("source_id, row_counts, period_start, period_end")
        .in("source_id", sourceIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const latestSnap = new Map<string, { row_counts: Record<string, number> | null; period_start: string | null; period_end: string | null }>();
  for (const snap of snapshots ?? []) {
    if (!latestSnap.has(snap.source_id)) latestSnap.set(snap.source_id, snap);
  }

  const allSources = sources ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Evidence</h2>
          <p className="text-sm text-muted-foreground">
            {allSources.length === 0
              ? "No sources yet."
              : `${allSources.length} source${allSources.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <AddSourceForm clientId={clientId} />
      </div>

      {allSources.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <Database className="size-9 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No evidence sources</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Paste GSC, Ahrefs, or SEMrush CSV exports to ground your content in real data.
          </p>
          <AddSourceForm clientId={clientId} />
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {allSources.map((source) => {
            const snap = latestSnap.get(source.id);
            const rowCounts = snap?.row_counts as Record<string, number> | null;
            const totalRows = rowCounts
              ? Object.values(rowCounts).reduce((a, b) => a + b, 0)
              : null;

            return (
              <div key={source.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{source.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {PROVIDER_LABELS[source.provider] ?? source.provider}
                    {snap?.period_start && snap?.period_end && (
                      <> · {snap.period_start} → {snap.period_end}</>
                    )}
                    {totalRows != null && (
                      <> · {totalRows.toLocaleString()} rows</>
                    )}
                  </p>
                  {source.staff_notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{source.staff_notes}</p>
                  )}
                </div>
                <DeleteSourceButton sourceId={source.id} clientId={clientId} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
