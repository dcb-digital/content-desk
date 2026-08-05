/**
 * Page package generation (brief §6.7). Unlike article drafts this is structured
 * output, not a stream: the whole package has to validate before it's worth showing.
 * §6.6 asks for one retry on validation failure, which is what the loop below does.
 */
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/ai/provider";
import { assemblePrompt } from "@/lib/ai/assemble";
import { PagePackageSchema } from "@/lib/ai/page-package";

/** One non-streaming call that writes a whole page — well past the 15s default. */
export const maxDuration = 120;

const RequestSchema = z.object({
  clientId: z.string().uuid(),
  workingTitle: z.string().min(1).max(300),
  targetKeyword: z.string().max(200).default(""),
  documentId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = RequestSchema.safeParse(await request.json() as unknown);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { clientId, workingTitle, targetKeyword, documentId } = parsed.data;

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }
  const workspaceId = membership.workspace_id;

  // RLS scopes this to the caller's workspace — a client id from another tenant 404s here.
  const { data: client } = await supabase
    .from("clients")
    .select("name, domain")
    .eq("id", clientId)
    .single();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

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

  /** Log every attempt, success or not — a silent failure here reads as "nothing happened". */
  async function logFailure(message: string, model: string) {
    await supabase.from("generation_logs").insert({
      workspace_id: workspaceId,
      client_id: clientId,
      document_id: documentId ?? null,
      action: "draft",
      provider: (settings?.default_provider as "anthropic") ?? "anthropic",
      model,
      success: false,
      error: message,
      user_id: user!.id,
    });
  }

  let assembled: Awaited<ReturnType<typeof assemblePrompt>>;
  let resolved: Awaited<ReturnType<typeof getModel>>;
  try {
    assembled = await assemblePrompt(supabase, clientId, workspaceId, "task_page_package", {
      workingTitle,
      targetKeyword: targetKeyword || "(none specified)",
      clientName: client.name as string,
    });
    resolved = await getModel(
      settings.providers as Record<string, { encKey: string; model: string }>,
      settings.default_provider as string,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation setup failed";
    await logFailure(message, "n/a");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { model, provider, modelId } = resolved;
  const startedAt = Date.now();

  // Attempt 2 gets told what went wrong; a schema miss is usually one bad field.
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const userContent =
      attempt === 0
        ? assembled.userContent
        : `${assembled.userContent}\n\n---\n\nYour previous attempt failed schema validation: ${lastError}\nReturn the complete object again with every required field present and correctly typed.`;

    try {
      const { object, usage } = await generateObject({
        model,
        schema: PagePackageSchema,
        system: assembled.system,
        prompt: userContent,
      });

      const inputCost = (usage.promptTokens / 1_000_000) * 3;
      const outputCost = (usage.completionTokens / 1_000_000) * 15;

      await supabase.from("generation_logs").insert({
        workspace_id: workspaceId,
        client_id: clientId,
        document_id: documentId ?? null,
        action: "draft",
        provider: provider as "anthropic" | "openai" | "openrouter",
        model: modelId,
        prompt_versions: assembled.promptVersions,
        input_tokens: usage.promptTokens,
        output_tokens: usage.completionTokens,
        est_cost_usd: inputCost + outputCost,
        duration_ms: Date.now() - startedAt,
        success: true,
        user_id: user.id,
      });

      return NextResponse.json({
        package: object,
        jsonLdContext: { clientName: client.name as string, domain: (client.domain as string | null) ?? null },
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown generation error";
    }
  }

  await logFailure(`Page package failed schema validation twice: ${lastError}`, modelId);
  return NextResponse.json(
    { error: `The model didn't return a valid page package after two attempts. ${lastError}` },
    { status: 502 },
  );
}
