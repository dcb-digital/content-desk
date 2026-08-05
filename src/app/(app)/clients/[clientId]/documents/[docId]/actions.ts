"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runQA, runPackageQA } from "@/lib/qa/rules";

export async function updateDocument({
  docId,
  bodyMd,
  status,
  targetKeyword,
}: {
  docId: string;
  bodyMd: string;
  status: string;
  targetKeyword?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: current } = await supabase
    .from("documents")
    .select("version, workspace_id, package_json")
    .eq("id", docId)
    .single();

  // Page packages are judged on their structured fields too — the markdown rendering
  // alone can't tell you the meta description is missing (brief §6.7).
  const qaResults = [...runQA(bodyMd, targetKeyword), ...runPackageQA(current?.package_json)];
  const hasFlags = qaResults.some((r) => r.level === "flag");

  // If there are hard flags and trying to approve, block and move to qa_flagged instead
  const resolvedStatus = status === "approved" && hasFlags ? "qa_flagged" : status;

  const { error } = await supabase
    .from("documents")
    .update({
      body_md: bodyMd,
      status: resolvedStatus,
      qa_results: qaResults,
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId);

  if (error) throw new Error(error.message);

  if (current) {
    const newVersion = (current.version ?? 1) + 1;
    await supabase.from("document_versions").insert({
      workspace_id: current.workspace_id,
      document_id: docId,
      version: newVersion,
      body_md: bodyMd,
      package_json: current.package_json ?? {},
      author: user.id,
    });
    await supabase
      .from("documents")
      .update({ version: newVersion })
      .eq("id", docId);
  }

  revalidatePath(`/clients`);
  return { qaResults, resolvedStatus };
}

export async function getDocumentVersions(docId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("document_versions")
    .select("id, version, author, created_at, body_md")
    .eq("document_id", docId)
    .order("version", { ascending: false })
    .limit(20);

  return data ?? [];
}

export async function restoreVersion(docId: string, bodyMd: string, version: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("documents").update({
    body_md: bodyMd,
    updated_at: new Date().toISOString(),
  }).eq("id", docId);

  revalidatePath(`/clients`);
}
