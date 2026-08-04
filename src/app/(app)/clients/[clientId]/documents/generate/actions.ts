"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveGeneratedDocument({
  clientId,
  title,
  bodyMd,
}: {
  clientId: string;
  title: string;
  bodyMd: string;
}): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("documents")
    .insert({
      client_id: clientId,
      title: title || "Untitled draft",
      kind: "blog_post",
      status: "in_review",
      body_md: bodyMd,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}
