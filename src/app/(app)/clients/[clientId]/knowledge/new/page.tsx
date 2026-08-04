import { DocForm } from "../doc-form";
import { createKnowledgeDoc } from "../actions";

type Props = { params: Promise<{ clientId: string }> };

export default async function NewKnowledgeDocPage({ params }: Props) {
  const { clientId } = await params;

  return (
    <DocForm
      clientId={clientId}
      heading="New knowledge doc"
      action={createKnowledgeDoc.bind(null, clientId)}
    />
  );
}
