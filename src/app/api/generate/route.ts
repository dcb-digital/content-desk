import { streamText } from "ai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai/provider";
import { assemblePrompt } from "@/lib/ai/assemble";
import { z } from "zod";

const RequestSchema = z.object({
  clientId: z.string().uuid(),
  taskKey: z.string(),
  taskVars: z.record(z.string()).default({}),
  documentId: z.string().uuid().optional(),
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
  const { clientId, taskKey, taskVars, documentId } = parsed.data;

  // Get workspace + settings
  const { data: membership } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", user.id)
    .single();
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
    return NextResponse.json(
      { error: "No LLM provider configured. Add one in Settings." },
      { status: 400 },
    );
  }

  // Assemble prompt + resolve the model. Both throw on misconfiguration (a prompt
  // key missing from the DB, an unknown provider) — return the reason instead of
  // letting it surface as an opaque 500 with an empty stream.
  let assembled: Awaited<ReturnType<typeof assemblePrompt>>;
  let model: Awaited<ReturnType<typeof getModel>>["model"];
  let provider: string;
  let modelId: string;
  try {
    assembled = await assemblePrompt(clientId, workspaceId, taskKey, taskVars);
    ({ model, provider, modelId } = await getModel(
      settings.providers as Record<string, { encKey: string; model: string }>,
      settings.default_provider as string,
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation setup failed";
    await supabase.from("generation_logs").insert({
      workspace_id: workspaceId,
      client_id: clientId,
      document_id: documentId ?? null,
      action: "draft",
      provider: (settings.default_provider as "anthropic") ?? "anthropic",
      model: "n/a",
      success: false,
      error: message,
      user_id: user.id,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const startedAt = Date.now();

  // Stream
  const result = streamText({
    model,
    system: assembled.system,
    messages: [{ role: "user", content: assembled.userContent }],
    onFinish: async ({ usage, text }) => {
      const durationMs = Date.now() - startedAt;
      // Rough cost estimate (Sonnet 4.6 pricing as default)
      const inputCost = (usage.promptTokens / 1_000_000) * 3;
      const outputCost = (usage.completionTokens / 1_000_000) * 15;
      const estCostUsd = inputCost + outputCost;

      // Log the generation
      await supabase.from("generation_logs").insert({
        workspace_id: workspaceId,
        client_id: clientId,
        document_id: documentId ?? null,
        action: (
          taskKey.includes("plan") ? "plan" :
          taskKey.includes("brief") ? "brief" :
          taskKey.includes("refresh") ? "refresh" :
          taskKey.includes("section") ? "section_rewrite" :
          "draft"
        ) as "draft",
        provider: provider as "anthropic" | "openai" | "openrouter",
        model: modelId,
        prompt_versions: assembled.promptVersions,
        input_tokens: usage.promptTokens,
        output_tokens: usage.completionTokens,
        est_cost_usd: estCostUsd,
        duration_ms: durationMs,
        success: true,
        user_id: user.id,
      });

      // Update document body if documentId provided
      if (documentId) {
        await supabase
          .from("documents")
          .update({ body_md: text, status: "in_review", updated_at: new Date().toISOString() })
          .eq("id", documentId);
      }
    },
  });

  return result.toTextStreamResponse();
}
