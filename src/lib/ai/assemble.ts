/**
 * Assembles the prompt message array for a generation call.
 * Fixed order (brief §6.6):
 *   1. system_rules  2. objectives_snapshot  3. pinned knowledge
 *   4. retrieved knowledge (Week 2)  5. evidence excerpts
 *   6. plan item / brief (Week 2)  7. task instruction
 *
 * All prompts fetched from DB — improving quality never requires a deploy.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { excerptSnapshot } from "@/lib/evidence/excerpt";
import type { NormalizedEvidence } from "@/db/schema";

/** Most recent snapshots considered (newest first). */
const MAX_SNAPSHOTS = 3;

export type AssembledPrompt = {
  system: string;
  userContent: string;
  promptVersions: Record<string, number>;
};

/**
 * The caller supplies the Supabase client because assembly runs in two very
 * different contexts: request handlers pass the RLS-scoped session client, and
 * the Inngest worker — which has no session — passes the service-role client and
 * scopes by workspace itself.
 */
export async function assemblePrompt(
  supabase: SupabaseClient,
  clientId: string,
  workspaceId: string,
  taskKey: string,
  taskVars: Record<string, string>,
  /**
   * Assembly step 6 (brief §6.6) — the plan item or approved brief this
   * generation works from. Task prompts that interpolate the brief themselves
   * (task_draft_from_brief) don't need it; structured tasks like the page
   * package have nowhere to put it, so it goes in as its own section.
   */
  planContext?: string,
): Promise<AssembledPrompt> {
  // Fetch the active prompts we need in one query
  const promptKeys = ["system_rules", taskKey];
  const { data: prompts } = await supabase
    .from("prompts")
    .select("key, version, body")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .in("key", promptKeys);

  const promptMap = Object.fromEntries(
    (prompts ?? []).map((p) => [p.key, p]),
  );
  const promptVersions: Record<string, number> = {};

  function getPrompt(key: string): string {
    const p = promptMap[key];
    if (!p) throw new Error(`Active prompt "${key}" not found in workspace`);
    promptVersions[key] = p.version;
    return p.body;
  }

  // 1. System rules
  const systemRules = getPrompt("system_rules");

  // Every query below is explicitly workspace-scoped as well as client-scoped.
  // Under the session client RLS would already do it; under the service-role
  // client it would not, and this function must be safe in both.

  // 2. Objectives snapshot (current)
  const { data: objective } = await supabase
    .from("objectives")
    .select("summary_md, data")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .eq("is_current", true)
    .maybeSingle();

  // 3. Pinned knowledge docs
  const { data: pinnedDocs } = await supabase
    .from("knowledge_docs")
    .select("title, type, body_md")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .eq("pinned", true)
    .order("type");

  // 5. Evidence excerpts — latest snapshots, each row tagged with its snapshot ref
  const { data: snapshots } = await supabase
    .from("evidence_snapshots")
    .select("id, provider, period_start, period_end, data")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(MAX_SNAPSHOTS);

  // Build the user-content block
  const sections: string[] = [];

  if (objective?.summary_md) {
    sections.push(`## CLIENT OBJECTIVES\n${objective.summary_md}`);
  } else {
    sections.push("## CLIENT OBJECTIVES\n[No objectives set — add them in the Objectives tab]");
  }

  if (pinnedDocs && pinnedDocs.length > 0) {
    const docsBlock = pinnedDocs
      .map((d) => `### ${d.title} (${d.type})\n${d.body_md}`)
      .join("\n\n");
    sections.push(`## KNOWLEDGE\n${docsBlock}`);
  } else {
    sections.push("## KNOWLEDGE\n[No pinned knowledge docs — add and pin them in the Knowledge tab]");
  }

  const evidenceBlocks = (snapshots ?? [])
    .map((s) =>
      excerptSnapshot(s.data as NormalizedEvidence, {
        id: s.id,
        provider: s.provider as string,
        periodStart: s.period_start as string | null,
        periodEnd: s.period_end as string | null,
      }),
    )
    .filter((b): b is string => b !== null);

  if (evidenceBlocks.length > 0) {
    sections.push(
      `## EVIDENCE\nEvery metric you state must cite the ref in brackets, e.g. [evidence:<id>]. ` +
        `If a figure is not in these excerpts, say the data is unavailable — never estimate one.\n\n` +
        evidenceBlocks.join("\n\n"),
    );
  } else {
    sections.push(
      "## EVIDENCE\n[No evidence snapshots for this client — upload exports in the Evidence tab. " +
        "State no metrics at all; say the data is unavailable.]",
    );
  }

  // 6. Plan item / approved brief
  if (planContext?.trim()) {
    sections.push(`## PLAN ITEM / APPROVED BRIEF\n${planContext.trim()}`);
  }

  // 7. Task instruction (interpolate vars)
  let taskBody = getPrompt(taskKey);
  for (const [key, value] of Object.entries(taskVars)) {
    taskBody = taskBody.replaceAll(`{{${key}}}`, value);
  }
  sections.push(`## TASK\n${taskBody}`);

  return {
    system: systemRules,
    userContent: sections.join("\n\n---\n\n"),
    promptVersions,
  };
}
