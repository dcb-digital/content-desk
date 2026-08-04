"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const DocSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  type: z.enum([
    "brand_voice", "services", "offers", "locations", "icp",
    "proof_case_studies", "banned_claims", "competitors", "product_facts", "other",
  ]),
  bodyMd: z.string().default(""),
  pinned: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

function estimateTokens(text: string): number {
  // ~4 chars per token — rough but good enough for the warning
  return Math.ceil(text.length / 4);
}

export async function createKnowledgeDoc(clientId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = DocSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    bodyMd: formData.get("bodyMd") || "",
    pinned: formData.get("pinned") === "true",
    tags: [],
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: client } = await supabase
    .from("clients").select("workspace_id").eq("id", clientId).single();
  if (!client) return { error: "Client not found" };

  const { error } = await supabase.from("knowledge_docs").insert({
    workspace_id: client.workspace_id,
    client_id: clientId,
    title: parsed.data.title,
    type: parsed.data.type,
    body_md: parsed.data.bodyMd,
    pinned: parsed.data.pinned,
    tags: parsed.data.tags,
    token_estimate: estimateTokens(parsed.data.bodyMd),
  });

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/knowledge`);
  redirect(`/clients/${clientId}/knowledge`);
}

export async function updateKnowledgeDoc(
  clientId: string,
  docId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = DocSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    bodyMd: formData.get("bodyMd") || "",
    pinned: formData.get("pinned") === "true",
    tags: [],
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("knowledge_docs")
    .update({
      title: parsed.data.title,
      type: parsed.data.type,
      body_md: parsed.data.bodyMd,
      pinned: parsed.data.pinned,
      token_estimate: estimateTokens(parsed.data.bodyMd),
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId)
    .eq("client_id", clientId);

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/knowledge`);
  redirect(`/clients/${clientId}/knowledge`);
}

export async function deleteKnowledgeDoc(clientId: string, docId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("knowledge_docs")
    .delete()
    .eq("id", docId)
    .eq("client_id", clientId);

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/knowledge`);
  return { success: true };
}

export async function togglePin(clientId: string, docId: string, pinned: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("knowledge_docs")
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq("id", docId)
    .eq("client_id", clientId);

  revalidatePath(`/clients/${clientId}/knowledge`);
}
