"use server";

import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const ProviderSchema = z.object({
  provider: z.enum(["anthropic", "openai", "openrouter"]),
  apiKey: z.string().min(10, "API key looks too short"),
  model: z.string().min(1, "Model is required"),
});

async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  return data?.workspace_id ?? null;
}

export async function saveProviderSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = ProviderSchema.safeParse({
    provider: formData.get("provider"),
    apiKey: formData.get("apiKey"),
    model: formData.get("model"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const workspaceId = await getWorkspaceId(supabase, user.id);
  if (!workspaceId) return { error: "No workspace found" };

  // Encrypt the API key before storing
  const encKey = await encrypt(parsed.data.apiKey);

  // Read existing settings
  const { data: existing } = await supabase
    .from("workspace_settings")
    .select("providers")
    .eq("workspace_id", workspaceId)
    .single();

  const providers = (existing?.providers as Record<string, { encKey: string; model: string }>) ?? {};
  providers[parsed.data.provider] = { encKey, model: parsed.data.model };

  const { error } = await supabase
    .from("workspace_settings")
    .upsert({
      workspace_id: workspaceId,
      providers,
      default_provider: parsed.data.provider,
      updated_at: new Date().toISOString(),
    });

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

export async function removeProvider(provider: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  if (!workspaceId) return { error: "No workspace found" };

  const { data: existing } = await supabase
    .from("workspace_settings")
    .select("providers")
    .eq("workspace_id", workspaceId)
    .single();

  const providers = { ...((existing?.providers as Record<string, unknown>) ?? {}) };
  delete providers[provider];

  await supabase
    .from("workspace_settings")
    .update({ providers, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId);

  revalidatePath("/settings");
}
