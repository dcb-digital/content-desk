import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { ScanOpportunitiesButton } from "./scan-opportunities-button";
import { SnapshotTables } from "./evidence-tables";
import type { NormalizedEvidence } from "@/db/schema";

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
    .select("id, label, provider, staff_notes, config")
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

  const data = (activeSnap?.data ?? {}) as NormalizedEvidence;
  const config = (source.config ?? {}) as {
    capturedColumns?: string[];
    parseWarnings?: string[];
    files?: { name: string; rows: number; format: string }[];
  };

  // Striking distance: position 4–20 with >20 impressions
  const strikingDistance = (data.queries ?? []).filter(
    (q) => q.position >= 4 && q.position <= 20 && q.impressions >= 20,
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
            // only the fields the scan needs — keeps `extra` bags off the client
            queries={strikingDistance.map((q) => ({
              query: q.query,
              clicks: q.clicks,
              impressions: q.impressions,
              ctr: q.ctr,
              position: q.position,
            }))}
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

      {config.parseWarnings && config.parseWarnings.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400">
          <p className="flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>{config.parseWarnings.join(" ")}</span>
          </p>
        </div>
      )}

      {!activeSnap && (
        <p className="text-sm text-muted-foreground">No snapshot data available for this source.</p>
      )}

      {strikingDistance.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400">
          <strong>{strikingDistance.length}</strong> striking distance queries (position 4–20) —
          click &quot;Scan opportunities&quot; to add them.
        </div>
      )}

      {activeSnap && <SnapshotTables data={data} />}

      {/* Provenance: exactly which columns were read out of the source files */}
      {config.capturedColumns && config.capturedColumns.length > 0 && (
        <details className="rounded-lg border border-border px-4 py-2">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            {config.capturedColumns.length} columns captured from{" "}
            {config.files?.length
              ? config.files.map((f) => f.name).join(", ")
              : "the pasted CSV"}
          </summary>
          <p className="text-xs text-muted-foreground mt-2 font-mono leading-relaxed">
            {config.capturedColumns.join(" · ")}
          </p>
        </details>
      )}
    </div>
  );
}
