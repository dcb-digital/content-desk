"use server";

import { createClient } from "@/lib/supabase/server";
import { runQA } from "@/lib/qa/rules";

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

  const qaResults = runQA(bodyMd, targetKeyword);
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

  return { qaResults, resolvedStatus };
}
