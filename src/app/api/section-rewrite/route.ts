import { generateText } from "ai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai/provider";
import { estimateCost } from "@/lib/ai/pricing";
import { z } from "zod";

const RequestSchema = z.object({
  clientId: z.string().uuid(),
  selectedText: z.string().min(1).max(10000),
  instruction: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as unknown;
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { clientId, selectedText, instruction } = parsed.data;

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }
  const workspaceId = membership.workspace_id;

  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("default_provider, providers")
    .eq("workspace_id", workspaceId)
    .single();

  if (!settings?.providers || Object.keys(settings.providers).length === 0) {
    return NextResponse.json({ error: "No LLM provider configured." }, { status: 400 });
  }

  // Try to fetch a custom section-rewrite prompt from DB; fall back to inline default
  const { data: promptRow } = await supabase
    .from("prompts")
    .select("body, version")
    .eq("workspace_id", workspaceId)
    .eq("key", "task_section_rewrite")
    .eq("is_active", true)
    .maybeSingle();

  const systemPrompt =
    "You are a precise content editor. Rewrite the given text exactly as instructed. " +
    "Return ONLY the rewritten text — no explanations, no preamble, no surrounding quotes. " +
    "Match the original formatting (markdown headings, lists, etc.) unless instructed otherwise. " +
    "Write in Australian English (en-AU).";

  const userContent = promptRow
    ? promptRow.body
        .replaceAll("{{selectedText}}", selectedText)
        .replaceAll("{{instruction}}", instruction)
    : `TEXT TO REWRITE:\n${selectedText}\n\nINSTRUCTION: ${instruction}\n\nRewrite the text above following the instruction. Keep a similar length unless the instruction asks for a change.`;

  const { model, provider, modelId } = await getModel(
    settings.providers as Record<string, { encKey: string; model: string }>,
    settings.default_provider as string,
  );

  const startedAt = Date.now();

  const { text, usage } = await generateText({
    model,
    system: systemPrompt,
    prompt: userContent,
    maxTokens: 2000,
  });

  const durationMs = Date.now() - startedAt;

  await supabase.from("generation_logs").insert({
    workspace_id: workspaceId,
    client_id: clientId,
    action: "section_rewrite",
    provider: provider as "anthropic" | "openai" | "openrouter",
    model: modelId,
    prompt_versions: promptRow ? { task_section_rewrite: promptRow.version } : {},
    input_tokens: usage.promptTokens,
    output_tokens: usage.completionTokens,
    est_cost_usd: (await estimateCost(provider, modelId, usage.promptTokens, usage.completionTokens)).usd,
    duration_ms: durationMs,
    success: true,
    user_id: user.id,
  });

  return NextResponse.json({ text });
}
