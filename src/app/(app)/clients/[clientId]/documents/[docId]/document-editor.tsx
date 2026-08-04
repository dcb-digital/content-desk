"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import { TipTapEditor } from "@/components/editor/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateDocument } from "./actions";

type Doc = {
  id: string;
  title: string;
  kind: string;
  status: string;
  body_md: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  drafting: { label: "Drafting", variant: "secondary" },
  in_review: { label: "In review", variant: "default" },
  approved: { label: "Approved", variant: "default" },
  exported: { label: "Exported", variant: "outline" },
  killed: { label: "Killed", variant: "outline" },
};

type Props = { doc: Doc; clientId: string };

export function DocumentEditor({ doc, clientId }: Props) {
  const router = useRouter();
  const [bodyMd, setBodyMd] = useState(doc.body_md ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initialHtml = doc.body_md ? (marked(doc.body_md) as string) : "";
  const status = STATUS_LABELS[doc.status] ?? { label: doc.status, variant: "outline" as const };

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateDocument({ docId: doc.id, bodyMd, status: "in_review" });
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setSaving(true);
    try {
      await updateDocument({ docId: doc.id, bodyMd, status: "approved" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{doc.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doc.kind} ·{" "}
            {new Date(doc.updated_at).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={status.variant}>{status.label}</Badge>
          {doc.status !== "approved" && (
            <Button variant="outline" size="sm" onClick={handleApprove} disabled={saving}>
              Approve
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <TipTapEditor
        content={initialHtml}
        editable={doc.status !== "exported" && doc.status !== "killed"}
        onChange={(text) => {
          setBodyMd(text);
          setSaved(false);
        }}
      />
    </div>
  );
}
