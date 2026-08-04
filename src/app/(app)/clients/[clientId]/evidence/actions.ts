"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseEvidence } from "@/lib/evidence/parse";

export async function addEvidenceSource(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const clientId = formData.get("clientId") as string;
  const label = formData.get("label") as string;
  const provider = formData.get("provider") as string;
  const staffNotes = formData.get("staffNotes") as string;
  const csvText = formData.get("csvText") as string;
  const periodStart = formData.get("periodStart") as string || null;
  const periodEnd = formData.get("periodEnd") as string || null;

  // Get workspace
  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) throw new Error("No workspace");

  // Create source row
  const { data: source, error: srcErr } = await supabase
    .from("evidence_sources")
    .insert({
      workspace_id: membership.workspace_id,
      client_id: clientId,
      provider,
      label,
      staff_notes: staffNotes || null,
    })
    .select("id")
    .single();

  if (srcErr) throw new Error(srcErr.message);

  // Parse + store snapshot if CSV provided
  if (csvText?.trim()) {
    const { data, rowCounts, format } = parseEvidence(csvText);
    await supabase.from("evidence_snapshots").insert({
      workspace_id: membership.workspace_id,
      client_id: clientId,
      source_id: source.id,
      provider,
      period_start: periodStart,
      period_end: periodEnd,
      data,
      row_counts: rowCounts,
    });
    // Update label to include detected format
    if (format !== "unknown" && format !== provider) {
      await supabase.from("evidence_sources")
        .update({ config: { detectedFormat: format } })
        .eq("id", source.id);
    }
  }

  revalidatePath(`/clients/${clientId}/evidence`);
}

export async function deleteEvidenceSource(sourceId: string, clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("evidence_sources").delete().eq("id", sourceId);
  revalidatePath(`/clients/${clientId}/evidence`);
}
