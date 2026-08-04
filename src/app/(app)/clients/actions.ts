"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const CreateClientSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  domain: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  locale: z.string().default("en-AU"),
  notes: z.string().optional(),
});

export async function createClientAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = CreateClientSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain") || undefined,
    industry: formData.get("industry") || undefined,
    locale: formData.get("locale") || "en-AU",
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Get the user's workspace (first active membership)
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membershipError || !membership) {
    return { error: "No workspace found for your account." };
  }

  const { error } = await supabase.from("clients").insert({
    workspace_id: membership.workspace_id,
    name: parsed.data.name,
    domain: parsed.data.domain ?? null,
    industry: parsed.data.industry ?? null,
    locale: parsed.data.locale,
    notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clients");
  redirect("/clients");
}
