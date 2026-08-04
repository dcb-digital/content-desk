import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsForm } from "./settings-form";

const PROVIDER_MODELS: Record<string, string[]> = {
  anthropic: [
    "claude-sonnet-4-6",
    "claude-opus-4-6",
    "claude-haiku-4-5-20251001",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  openrouter: [
    "anthropic/claude-sonnet-4-6",
    "anthropic/claude-opus-4-6",
    "openai/gpt-4o",
    "meta-llama/llama-3.1-70b-instruct",
  ],
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .single();

  const { data: settings } = membership
    ? await supabase
        .from("workspace_settings")
        .select("default_provider, providers, fast_model")
        .eq("workspace_id", membership.workspace_id)
        .single()
    : { data: null };

  const configuredProviders = Object.keys(
    (settings?.providers as Record<string, unknown>) ?? {}
  );

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          LLM providers and workspace configuration.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">LLM providers</h2>
          <p className="text-sm text-muted-foreground">
            API keys are AES-GCM encrypted before storage and never sent to the
            browser.
          </p>
        </div>

        {configuredProviders.length > 0 && (
          <div className="rounded-lg border border-border divide-y divide-border">
            {configuredProviders.map((p) => (
              <div key={p} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize">{p}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    sk-••••••••••••••••••••••••••••••
                  </p>
                </div>
                {settings?.default_provider === p && (
                  <span className="text-xs text-primary font-medium">Default</span>
                )}
              </div>
            ))}
          </div>
        )}

        <SettingsForm
          providerModels={PROVIDER_MODELS}
          defaultProvider={(settings?.default_provider as string) ?? "anthropic"}
        />
      </section>
    </div>
  );
}
