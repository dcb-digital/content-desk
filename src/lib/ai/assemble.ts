/**
 * Assembles the prompt message array for a generation call.
 * Fixed order (brief §6.6):
 *   1. system_rules  2. objectives_snapshot  3. pinned knowledge
 *   4. retrieved knowledge (Week 2)  5. evidence excerpts (Week 2)
 *   6. plan item / brief (Week 2)  7. task instruction
 *
 * All prompts fetched from DB — improving quality never requires a deploy.
 */
import { createClient } from "@/lib/supabase/server";

export type AssembledPrompt = {
  system: string;
  userContent: string;
  promptVersions: Record<string, number>;
};

export async function assemblePrompt(
  clientId: string,
  workspaceId: string,
  taskKey: string,
  taskVars: Record<string, string>,
): Promise<AssembledPrompt> {
  const supabase = await createClient();

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

  // 2. Objectives snapshot (current)
  const { data: objective } = await supabase
    .from("objectives")
    .select("summary_md, data")
    .eq("client_id", clientId)
    .eq("is_current", true)
    .maybeSingle();

  // 3. Pinned knowledge docs
  const { data: pinnedDocs } = await supabase
    .from("knowledge_docs")
    .select("title, type, body_md")
    .eq("client_id", clientId)
    .eq("pinned", true)
    .order("type");

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
