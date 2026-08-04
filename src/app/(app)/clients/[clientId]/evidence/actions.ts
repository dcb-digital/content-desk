"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isSupportedEvidenceFile,
  mergeEvidence,
  parseEvidence,
  type ParsedEvidence,
} from "@/lib/evidence/parse";
import {
  EVIDENCE_BUCKET,
  MAX_EVIDENCE_FILE_BYTES,
  isPathInScope,
  type EvidenceUpload,
} from "@/lib/evidence/storage";

type AddSourceResult = { error?: string; warning?: string; rows?: number; format?: string };

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Drops objects we couldn't turn into a snapshot, so failures leave no orphans. */
async function discardUploads(supabase: SupabaseClient, uploads: EvidenceUpload[]) {
  if (!uploads.length) return;
  await supabase.storage.from(EVIDENCE_BUCKET).remove(uploads.map((u) => u.path));
}

export async function addEvidenceSource(formData: FormData): Promise<AddSourceResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const clientId = formData.get("clientId") as string;
  const label = ((formData.get("label") as string) ?? "").trim();
  const provider = formData.get("provider") as string;
  const staffNotes = formData.get("staffNotes") as string;
  const csvText = formData.get("csvText") as string;
  const periodStart = formData.get("periodStart") as string || null;
  const periodEnd = formData.get("periodEnd") as string || null;

  if (!clientId || !label || !provider) return { error: "Label and provider are required" };

  // Get workspace first — it scopes both the storage paths and the inserts
  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) return { error: "No workspace" };
  const workspaceId = membership.workspace_id as string;

  // Files were uploaded straight to Storage; we only receive their paths
  let uploads: EvidenceUpload[] = [];
  const rawUploads = formData.get("uploads");
  if (typeof rawUploads === "string" && rawUploads.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawUploads);
      if (!Array.isArray(parsed)) throw new Error("not a list");
      uploads = parsed as EvidenceUpload[];
    } catch {
      return { error: "Malformed upload list." };
    }
  }

  const outOfScope = uploads.filter((u) => !isPathInScope(u.path, workspaceId, clientId));
  if (outOfScope.length) {
    // RLS would refuse these anyway; fail loudly rather than half-importing
    return { error: "Upload path rejected." };
  }

  const parts: ParsedEvidence[] = [];
  const fileMeta: {
    name: string;
    size: number;
    format: string;
    rows: number;
    headers: string[];
    path: string;
  }[] = [];
  const skipped: string[] = [];
  const notes: string[] = [];

  for (const upload of uploads) {
    if (!isSupportedEvidenceFile(upload.name)) {
      skipped.push(`${upload.name} (unsupported type)`);
      continue;
    }
    if (upload.size > MAX_EVIDENCE_FILE_BYTES) {
      skipped.push(`${upload.name} (too large)`);
      continue;
    }

    const { data: blob, error: dlErr } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .download(upload.path);
    if (dlErr || !blob) {
      skipped.push(`${upload.name} (could not be read back from storage)`);
      continue;
    }

    const parsed = parseEvidence(await blob.text(), upload.name);
    notes.push(...parsed.warnings);
    const rows = Object.values(parsed.rowCounts).reduce((a, b) => a + b, 0);
    if (rows === 0) {
      skipped.push(upload.name);
      continue;
    }
    parts.push(parsed);
    fileMeta.push({
      name: upload.name,
      size: upload.size,
      format: parsed.format,
      rows,
      headers: parsed.headers,
      path: upload.path,
    });
  }

  if (csvText?.trim()) {
    const parsed = parseEvidence(csvText, "pasted CSV");
    notes.push(...parsed.warnings);
    if (Object.values(parsed.rowCounts).reduce((a, b) => a + b, 0) > 0) parts.push(parsed);
    else if (!uploads.length) return { error: "Couldn't recognise any rows in the pasted CSV." };
  }

  // Files were attached but nothing readable came out — don't create an empty source
  if (uploads.length > 0 && parts.length === 0) {
    await discardUploads(supabase, uploads);
    return {
      error: notes.length
        ? `Couldn't read any rows from ${skipped.join(", ")}. ${notes.join(" ")}`
        : `Couldn't read any rows from ${skipped.join(", ")}. Expected a GSC, Ahrefs, SEMrush or GA4 CSV export.`,
    };
  }

  const merged = parts.length ? mergeEvidence(parts) : null;

  // Create source row
  const { data: source, error: srcErr } = await supabase
    .from("evidence_sources")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      provider,
      label,
      staff_notes: staffNotes || null,
      config: merged
        ? {
            detectedFormat: merged.format,
            // provenance: exactly which columns came in, so nothing is a mystery later
            capturedColumns: merged.headers,
            ...(fileMeta.length ? { files: fileMeta } : {}),
            ...(merged.warnings.length ? { parseWarnings: merged.warnings } : {}),
          }
        : {},
    })
    .select("id")
    .single();

  if (srcErr) {
    await discardUploads(supabase, uploads);
    return { error: srcErr.message };
  }

  if (merged) {
    const { error: snapErr } = await supabase.from("evidence_snapshots").insert({
      workspace_id: workspaceId,
      client_id: clientId,
      source_id: source.id,
      provider,
      period_start: periodStart,
      period_end: periodEnd,
      data: merged.data,
      row_counts: merged.rowCounts,
    });
    if (snapErr) {
      // Roll back so a failed import doesn't leave a source with no snapshot
      await supabase.from("evidence_sources").delete().eq("id", source.id);
      await discardUploads(supabase, uploads);
      return { error: snapErr.message };
    }
  }

  // Files we couldn't use aren't part of the audit trail — don't keep paying for them
  const usedPaths = new Set(fileMeta.map((f) => f.path));
  await discardUploads(
    supabase,
    uploads.filter((u) => !usedPaths.has(u.path)),
  );

  revalidatePath(`/clients/${clientId}/evidence`);

  const warnings = [
    ...(skipped.length ? [`Skipped ${skipped.join(", ")}.`] : []),
    ...notes,
  ];

  return {
    rows: merged ? Object.values(merged.rowCounts).reduce((a, b) => a + b, 0) : 0,
    format: merged?.format,
    warning: warnings.length ? warnings.join(" ") : undefined,
  };
}

export async function deleteEvidenceSource(sourceId: string, clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Delete the stored files too, or the bucket accumulates orphans forever
  const { data: source } = await supabase
    .from("evidence_sources")
    .select("config")
    .eq("id", sourceId)
    .maybeSingle();

  const paths = (
    ((source?.config as { files?: { path?: string }[] } | null)?.files ?? [])
      .map((f) => f.path)
      .filter((p): p is string => typeof p === "string" && p.length > 0)
  );
  if (paths.length) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove(paths);
  }

  await supabase.from("evidence_sources").delete().eq("id", sourceId);
  revalidatePath(`/clients/${clientId}/evidence`);
}
