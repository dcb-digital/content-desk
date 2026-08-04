"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const ObjectivesSchema = z.object({
  primaryGoal: z.string().min(1, "Primary goal is required"),
  successMetric: z.string().min(1, "Success metric is required"),
  numericTarget: z.number().optional().nullable(),
  priorityServices: z.array(z.string()).default([]),
  priorityLocations: z.array(z.string()).default([]),
  audienceNotes: z.string().optional(),
  constraints: z.string().optional(),
  freeText: z.string().optional(),
});

function splitLines(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function generateSummary(data: z.infer<typeof ObjectivesSchema>): string {
  const services = data.priorityServices.join(", ") || "their core services";
  const locations = data.priorityLocations.join(", ") || "their service area";
  const metric = data.numericTarget
    ? `${data.successMetric} (target: ${data.numericTarget})`
    : data.successMetric;

  let summary = `This client's primary goal is ${data.primaryGoal}. Success is measured by: ${metric}.`;

  if (data.priorityServices.length > 0) {
    summary += ` Priority services: ${services}.`;
  }
  if (data.priorityLocations.length > 0) {
    summary += ` Key locations: ${locations}.`;
  }
  if (data.audienceNotes) {
    summary += ` Audience: ${data.audienceNotes}`;
  }
  if (data.constraints) {
    summary += ` Constraints: ${data.constraints}`;
  }

  return summary;
}

export async function saveObjectives(clientId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const numericRaw = formData.get("numericTarget") as string;
  const parsed = ObjectivesSchema.safeParse({
    primaryGoal: formData.get("primaryGoal"),
    successMetric: formData.get("successMetric"),
    numericTarget: numericRaw ? Number(numericRaw) : null,
    priorityServices: splitLines(formData.get("priorityServices") as string ?? ""),
    priorityLocations: splitLines(formData.get("priorityLocations") as string ?? ""),
    audienceNotes: formData.get("audienceNotes") || undefined,
    constraints: formData.get("constraints") || undefined,
    freeText: formData.get("freeText") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: client } = await supabase
    .from("clients").select("workspace_id").eq("id", clientId).single();
  if (!client) return { error: "Client not found" };

  const summaryOverride = (formData.get("summaryMd") as string)?.trim();
  const summaryMd = summaryOverride || generateSummary(parsed.data);

  // Mark previous objectives as not current
  await supabase
    .from("objectives")
    .update({ is_current: false })
    .eq("client_id", clientId)
    .eq("is_current", true);

  const { error } = await supabase.from("objectives").insert({
    workspace_id: client.workspace_id,
    client_id: clientId,
    data: parsed.data,
    summary_md: summaryMd,
    is_current: true,
  });

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/objectives`);
  redirect(`/clients/${clientId}/objectives`);
}
