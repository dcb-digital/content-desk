"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPlan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const clientId = formData.get("clientId") as string;

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) throw new Error("No workspace");

  // Get current objectives snapshot
  const { data: objective } = await supabase
    .from("objectives")
    .select("data, summary_md")
    .eq("client_id", clientId)
    .eq("is_current", true)
    .maybeSingle();

  const horizonDays = parseInt(formData.get("horizonDays") as string) || 30;
  const startDate = formData.get("startDate") as string;

  const { data: plan, error } = await supabase
    .from("content_plans")
    .insert({
      workspace_id: membership.workspace_id,
      client_id: clientId,
      name: formData.get("name") as string,
      horizon_days: horizonDays,
      focus_mode: formData.get("focusMode") as string || "balanced",
      status: "draft",
      start_date: startDate,
      frequency: {
        posts: { n: parseInt(formData.get("postsPerMonth") as string) || 4, per: "month" },
        pages: { n: parseInt(formData.get("pagesPerMonth") as string) || 1, per: "month" },
      },
      objectives_snapshot: (objective ?? {}) as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${clientId}/plans`);
  redirect(`/clients/${clientId}/plans/${plan.id}`);
}

export async function addPlanItem(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const planId = formData.get("planId") as string;
  const clientId = formData.get("clientId") as string;

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) throw new Error("No workspace");

  await supabase.from("plan_items").insert({
    workspace_id: membership.workspace_id,
    plan_id: planId,
    client_id: clientId,
    type: formData.get("type") as string || "post",
    scheduled_date: formData.get("scheduledDate") as string,
    working_title: formData.get("workingTitle") as string,
    target_keyword: (formData.get("targetKeyword") as string) || null,
    status: "planned",
  });

  revalidatePath(`/clients/${clientId}/plans/${planId}`);
}

export async function deletePlanItem(itemId: string, planId: string, clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("plan_items").delete().eq("id", itemId);
  revalidatePath(`/clients/${clientId}/plans/${planId}`);
}
