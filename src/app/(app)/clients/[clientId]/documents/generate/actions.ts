"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveGeneratedDocument({
  clientId,
  title,
  bodyMd,
  planItemId,
}: {
  clientId: string;
  title: string;
  bodyMd: string;
  planItemId?: string;
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
      title: title || "Untitled draft",
      kind: "draft",
      status: "in_review",
      body_md: bodyMd,
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
