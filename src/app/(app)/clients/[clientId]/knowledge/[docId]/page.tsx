import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocForm } from "../doc-form";
import { updateKnowledgeDoc } from "../actions";

type Props = { params: Promise<{ clientId: string; docId: string }> };

export default async function EditKnowledgeDocPage({ params }: Props) {
  const { clientId, docId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: doc } = await supabase
    .from("knowledge_docs")
    .select("id, title, type, body_md, pinned")
    .eq("id", docId)
    .eq("client_id", clientId)
    .single();

  if (!doc) notFound();

  return (
    <DocForm
      clientId={clientId}
      heading={`Edit: ${doc.title}`}
      action={updateKnowledgeDoc.bind(null, clientId, docId)}
      defaultValues={{
        title: doc.title,
        type: doc.type,
        bodyMd: doc.body_md,
        pinned: doc.pinned,
      }}
    />
  );
}
