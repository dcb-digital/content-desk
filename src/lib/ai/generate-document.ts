/**
 * Generates one document for one plan item, start to finish, without a request
 * or a session behind it.
 *
 * The interactive routes stream into an editor with a human watching. This runs
 * at 5pm with nobody watching, so it does the things that human would otherwise
 * do on save: run QA, set the status the flags imply, move the plan item, and
 * log the generation. Everything is workspace-scoped explicitly — the caller
 * hands in the service-role client, which has no RLS to fall back on.
 */
import { generateObject, generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getModel } from "@/lib/ai/provider";
import { assemblePrompt } from "@/lib/ai/assemble";
import { PagePackageSchema, packageToMarkdown } from "@/lib/ai/page-package";
import { estimateCost } from "@/lib/ai/pricing";
import { runQA, runPackageQA } from "@/lib/qa/rules";

export type PlanItemType = "post" | "page" | "refresh";
export type GenerationTarget = "brief" | "draft";

export type PlanItemInput = {
  id: string;
  type: PlanItemType;
  workingTitle: string;
  targetKeyword: string | null;
  targetUrl: string | null;
  scheduledDate: string | null;
};

export type GenerateResult = {
  documentId: string;
  status: string;
  qaFlagCount: number;
};

const DRAFT_TASK_BY_TYPE: Record<PlanItemType, string> = {
  post: "task_draft_post",
  page: "task_page_package",
  refresh: "task_refresh",
};

/**
 * What a plan item should produce next, honouring the client's brief gate. A
 * gated client gets a brief first; the draft only comes once a human approves
 * it. Batch mode must not be the way that gate gets bypassed.
 */
export function nextActionForItem(
  itemStatus: string,
  briefGateEnabled: boolean,
): GenerationTarget | null {
  if (itemStatus === "planned") return briefGateEnabled ? "brief" : "draft";
  if (itemStatus === "brief_approved") return "draft";
  // briefed (awaiting approval), drafting, in_review, approved, exported, killed
  return null;
}

export async function generateForPlanItem({
  supabase,
  workspaceId,
  clientId,
  clientName,
  planItem,
  action,
  userId,
}: {
  supabase: SupabaseClient;
  workspaceId: string;
  clientId: string;
  clientName: string;
  planItem: PlanItemInput;
  action: GenerationTarget;
  userId: string | null;
}): Promise<GenerateResult> {
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("default_provider, providers")
    .eq("workspace_id", workspaceId)
    .single();

  if (!settings?.providers || Object.keys(settings.providers).length === 0) {
    throw new Error("No LLM provider configured. Add one in Settings.");
  }

  const isPagePackage = action === "draft" && planItem.type === "page";
  const approvedBrief = action === "draft" ? await findApprovedBrief(supabase, workspaceId, planItem.id) : null;

  // A brief the model can interpolate itself takes the dedicated task prompt;
  // otherwise it rides along as assembly step 6.
  const useBriefTask = action === "draft" && approvedBrief !== null && !isPagePackage;
  const taskKey = action === "brief"
    ? "task_brief"
    : useBriefTask
      ? "task_draft_from_brief"
      : DRAFT_TASK_BY_TYPE[planItem.type];

  const taskVars: Record<string, string> = {
    workingTitle: planItem.workingTitle,
    targetKeyword: planItem.targetKeyword || "(none specified)",
    clientName,
  };
  if (useBriefTask && approvedBrief) taskVars.briefContent = approvedBrief;

  const planContext = buildPlanContext(planItem, useBriefTask ? null : approvedBrief);

  const assembled = await assemblePrompt(
    supabase,
    clientId,
    workspaceId,
    taskKey,
    taskVars,
    planContext,
  );
  const { model, provider, modelId } = await getModel(
    settings.providers as Record<string, { encKey: string; model: string }>,
    settings.default_provider as string,
  );

  // Page packages are their own action so the usage screen can tell them apart
  // from ordinary drafts — they cost noticeably more per generation.
  const logAction = action === "brief" ? "brief" : isPagePackage ? "page_package" : "draft";

  const startedAt = Date.now();
  let bodyMd: string;
  let packageJson: Record<string, unknown> | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    if (isPagePackage) {
      const { object, usage } = await generateObject({
        model,
        schema: PagePackageSchema,
        system: assembled.system,
        prompt: assembled.userContent,
      });
      packageJson = object as unknown as Record<string, unknown>;
      bodyMd = packageToMarkdown(object);
      inputTokens = usage.promptTokens;
      outputTokens = usage.completionTokens;
    } else {
      const { text, usage } = await generateText({
        model,
        system: assembled.system,
        prompt: assembled.userContent,
      });
      bodyMd = text;
      inputTokens = usage.promptTokens;
      outputTokens = usage.completionTokens;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await supabase.from("generation_logs").insert({
      workspace_id: workspaceId,
      client_id: clientId,
      action: logAction,
      provider: provider as "anthropic",
      model: modelId,
      prompt_versions: assembled.promptVersions,
      duration_ms: Date.now() - startedAt,
      success: false,
      error: message,
      user_id: userId,
    });
    throw new Error(message);
  }

  // Nobody is watching this run, so QA decides the status rather than a human
  // clicking save later (brief §6.8).
  const qaResults =
    action === "brief"
      ? []
      : [...runQA(bodyMd, planItem.targetKeyword ?? undefined), ...runPackageQA(packageJson)];
  const qaFlagCount = qaResults.filter((r) => r.level === "flag").length;
  const status = action === "brief" ? "briefed" : qaFlagCount > 0 ? "qa_flagged" : "in_review";

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      plan_item_id: planItem.id,
      kind: action === "brief" ? "brief" : "draft",
      title: planItem.workingTitle,
      body_md: bodyMd,
      package_json: packageJson ?? {},
      qa_results: qaResults,
      status,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  await supabase
    .from("plan_items")
    .update({ status })
    .eq("id", planItem.id)
    .eq("workspace_id", workspaceId);

  await supabase.from("status_events").insert({
    workspace_id: workspaceId,
    document_id: doc.id,
    plan_item_id: planItem.id,
    from_status: "planned",
    to_status: status,
    user_id: userId,
    note: `Batch ${action}`,
  });

  await supabase.from("generation_logs").insert({
    workspace_id: workspaceId,
    client_id: clientId,
    document_id: doc.id,
    action: logAction,
    provider: provider as "anthropic" | "openai" | "openrouter",
    model: modelId,
    prompt_versions: assembled.promptVersions,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    est_cost_usd: (await estimateCost(provider, modelId, inputTokens, outputTokens)).usd,
    duration_ms: Date.now() - startedAt,
    success: true,
    user_id: userId,
  });

  return { documentId: doc.id as string, status, qaFlagCount };
}

/** The approved brief for this plan item, if a human has signed one off. */
async function findApprovedBrief(
  supabase: SupabaseClient,
  workspaceId: string,
  planItemId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("documents")
    .select("body_md")
    .eq("workspace_id", workspaceId)
    .eq("plan_item_id", planItemId)
    .eq("kind", "brief")
    .eq("status", "brief_approved")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.body_md as string | undefined)?.trim() || null;
}

function buildPlanContext(planItem: PlanItemInput, approvedBrief: string | null): string {
  const lines = [
    `Working title: ${planItem.workingTitle}`,
    `Content type: ${planItem.type}`,
    `Target keyword: ${planItem.targetKeyword || "(none specified)"}`,
  ];
  if (planItem.targetUrl) lines.push(`Existing URL being refreshed: ${planItem.targetUrl}`);
  if (planItem.scheduledDate) lines.push(`Scheduled for: ${planItem.scheduledDate}`);
  if (approvedBrief) lines.push("", "APPROVED BRIEF:", approvedBrief);
  return lines.join("\n");
}
