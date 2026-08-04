"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateClientAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clientId = formData.get("clientId") as string;

  const { error } = await supabase
    .from("clients")
    .update({
      name: formData.get("name") as string,
      domain: (formData.get("domain") as string) || null,
      industry: (formData.get("industry") as string) || null,
      locale: (formData.get("locale") as string) || "en-AU",
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", clientId);

  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function archiveClientAction(clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", clientId);

  revalidatePath("/clients");
  redirect("/clients");
}
