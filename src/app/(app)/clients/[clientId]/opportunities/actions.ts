"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addOpportunity(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const clientId = formData.get("clientId") as string;

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) throw new Error("No workspace");

  await supabase.from("opportunities").insert({
    workspace_id: membership.workspace_id,
    client_id: clientId,
    type: formData.get("type") as string,
    title: formData.get("title") as string,
    rationale: (formData.get("rationale") as string) || null,
    suggested_type: (formData.get("suggested_type") as string) || "post",
    score: parseFloat((formData.get("score") as string) || "50"),
    status: "open",
  });

  revalidatePath(`/clients/${clientId}/opportunities`);
}

export async function setOpportunityStatus(id: string, status: string, clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("opportunities").update({ status }).eq("id", id);
  revalidatePath(`/clients/${clientId}/opportunities`);
}

export async function deleteOpportunity(id: string, clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("opportunities").delete().eq("id", id);
  revalidatePath(`/clients/${clientId}/opportunities`);
}
