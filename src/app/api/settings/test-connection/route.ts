import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { provider } = await request.json() as { provider: string };

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) return NextResponse.json({ ok: false, error: "No workspace" });

  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("providers")
    .eq("workspace_id", membership.workspace_id)
    .single();

  const providers = settings?.providers as Record<string, { encKey: string; model: string }> ?? {};
  const providerConfig = providers[provider];
  if (!providerConfig) {
    return NextResponse.json({ ok: false, error: `No ${provider} key configured` });
  }

  try {
    const apiKey = await decrypt(providerConfig.encKey);
    let ok = false;

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      ok = res.ok;
    } else if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      ok = res.ok;
    } else if (provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      ok = res.ok;
    }

    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}
