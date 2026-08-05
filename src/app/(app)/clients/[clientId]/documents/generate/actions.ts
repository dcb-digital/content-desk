"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveGeneratedDocument({
  clientId,
  title,
  bodyMd,
  planItemId,
  kind = "draft",
  packageJson,
}: {
  clientId: string;
  title: string;
  bodyMd: string;
  planItemId?: string;
  kind?: "brief" | "draft";
  /** Page package (brief §6.7) — bodyMd stays the markdown rendering of it. */
  packageJson?: Record<string, unknown>;
}): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) throw new Error("No workspace");

  const { data, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: membership.workspace_id,
      client_id: clientId,
      plan_item_id: planItemId ?? null,
      title: title || (kind === "brief" ? "Untitled brief" : "Untitled draft"),
      kind,
      status: kind === "brief" ? "briefed" : "in_review",
      body_md: bodyMd,
      package_json: packageJson ?? {},
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Mark the plan item as drafting if linked
  if (planItemId) {
    await supabase
      .from("plan_items")
      .update({ status: "drafting" })
      .eq("id", planItemId);
  }

  return data.id;
}
