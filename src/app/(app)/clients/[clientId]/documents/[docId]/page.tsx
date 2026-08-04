import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DocumentEditor } from "./document-editor";

type Props = { params: Promise<{ clientId: string; docId: string }> };

export default async function DocumentPage({ params }: Props) {
  const { clientId, docId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, kind, status, body_md, created_at, updated_at")
    .eq("id", docId)
    .eq("client_id", clientId)
    .single();

  if (!doc) notFound();

  return <DocumentEditor doc={doc} clientId={clientId} />;
}
