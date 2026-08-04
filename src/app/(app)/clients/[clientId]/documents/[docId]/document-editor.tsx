"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import { TipTapEditor } from "@/components/editor/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateDocument } from "./actions";
import { Copy, Check, Download } from "lucide-react";

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
  planned: { label: "Planned", variant: "outline" },
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
  const [wordCount, setWordCount] = useState(() =>
    doc.body_md ? doc.body_md.trim().split(/\s+/).filter(Boolean).length : 0
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const initialHtml = doc.body_md ? marked.parse(doc.body_md, { async: false }) : "";
  const status = STATUS_LABELS[doc.status] ?? { label: doc.status, variant: "outline" as const };
  const editable = doc.status !== "exported" && doc.status !== "killed";

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

  async function handleCopy() {
    await navigator.clipboard.writeText(bodyMd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([bodyMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{doc.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doc.kind} ·{" "}
            {new Date(doc.updated_at).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <Badge variant={status.variant}>{status.label}</Badge>
          <Button variant="ghost" size="sm" onClick={handleDownload} title="Download .md">
            <Download className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} title="Copy markdown">
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
          </Button>
          {editable && doc.status !== "approved" && (
            <Button variant="outline" size="sm" onClick={handleApprove} disabled={saving}>
              Approve
            </Button>
          )}
          {editable && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </Button>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground text-right">
        {wordCount.toLocaleString()} words
      </div>

      <TipTapEditor
        content={initialHtml}
        editable={editable}
        onChange={(text) => {
          setBodyMd(text);
          setSaved(false);
          setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
        }}
      />
    </div>
  );
}
