"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateDocument({
  docId,
  bodyMd,
  status,
}: {
  docId: string;
  bodyMd: string;
  status: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("documents")
    .update({
      body_md: bodyMd,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId);

  if (error) throw new Error(error.message);
}
