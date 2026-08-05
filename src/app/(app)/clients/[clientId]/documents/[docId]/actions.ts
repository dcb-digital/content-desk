"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runQA, runPackageQA } from "@/lib/qa/rules";

export async function updateDocument({
  docId,
  bodyMd,
  status,
  targetKeyword,
  packageJson,
}: {
  docId: string;
  bodyMd: string;
  status: string;
  targetKeyword?: string;
  /**
   * Page packages only. The package is canonical for those documents and `bodyMd`
   * is its markdown rendering, so both are written together — persisting one
   * without the other is what let the exports drift from the copy.
   */
  packageJson?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: current } = await supabase
    .from("documents")
    .select("version, workspace_id, package_json")
    .eq("id", docId)
    .single();

  const effectivePackage = packageJson ?? current?.package_json;

  // Page packages are judged on their structured fields too — the markdown rendering
  // alone can't tell you the meta description is missing (brief §6.7).
  const qaResults = [...runQA(bodyMd, targetKeyword), ...runPackageQA(effectivePackage)];
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
      ...(packageJson ? { package_json: packageJson } : {}),
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
      package_json: effectivePackage ?? {},
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
    .select("id, version, author, created_at, body_md, package_json")
    .eq("document_id", docId)
    .order("version", { ascending: false })
    .limit(20);

  return data ?? [];
}

/** Restores both halves — a package document rolled back on body alone would be inconsistent. */
export async function restoreVersion(
  docId: string,
  bodyMd: string,
  version: number,
  packageJson?: Record<string, unknown>,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("documents").update({
    body_md: bodyMd,
    updated_at: new Date().toISOString(),
    ...(packageJson ? { package_json: packageJson } : {}),
  }).eq("id", docId);

  revalidatePath(`/clients`);
}
