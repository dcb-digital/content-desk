"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function savePrompt(promptId: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch current version so we can increment it
  const { data: current } = await supabase
    .from("prompts")
    .select("version")
    .eq("id", promptId)
    .single();

  const { error } = await supabase
    .from("prompts")
    .update({ body, version: (current?.version ?? 1) + 1 })
    .eq("id", promptId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/prompts");
}
