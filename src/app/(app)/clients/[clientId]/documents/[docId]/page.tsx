import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DocumentEditor } from "./document-editor";

type Props = { params: Promise<{ clientId: string; docId: string }> };

export default async function DocumentPage({ params }: Props) {
  const { clientId, docId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: doc }, { data: client }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, kind, status, body_md, package_json, qa_results, created_at, updated_at")
      .eq("id", docId)
      .eq("client_id", clientId)
      .single(),
    // Name and domain are what the JSON-LD builder needs; nothing else is fetched.
    supabase.from("clients").select("name, domain").eq("id", clientId).single(),
  ]);

  if (!doc) notFound();

  return (
    <DocumentEditor
      doc={doc}
      clientId={clientId}
      jsonLdContext={{ clientName: client?.name ?? "", domain: client?.domain ?? null }}
    />
  );
}
