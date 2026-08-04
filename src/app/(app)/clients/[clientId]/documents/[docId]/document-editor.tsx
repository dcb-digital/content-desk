"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import TurndownService from "turndown";
import { TipTapEditor } from "@/components/editor/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateDocument } from "./actions";
import { Copy, Check, Download, AlertTriangle, Info, Code2 } from "lucide-react";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });

type QAResult = {
  rule: string;
  level: "flag" | "warn";
  message: string;
};

type Doc = {
  id: string;
  title: string;
  kind: string;
  status: string;
  body_md: string | null;
  qa_results: QAResult[] | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  planned: { label: "Planned", variant: "outline" },
  drafting: { label: "Drafting", variant: "secondary" },
  in_review: { label: "In review", variant: "default" },
  qa_flagged: { label: "QA flagged", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  exported: { label: "Exported", variant: "outline" },
  killed: { label: "Killed", variant: "outline" },
};

type Props = { doc: Doc; clientId: string };

export function DocumentEditor({ doc, clientId }: Props) {
  const router = useRouter();
  // bodyMd tracks markdown; htmlRef tracks the current HTML for copy-as-HTML
  const [bodyMd, setBodyMd] = useState(doc.body_md ?? "");
  const htmlRef = useRef<string>(doc.body_md ? marked.parse(doc.body_md, { async: false }) : "");
  const [wordCount, setWordCount] = useState(() =>
    doc.body_md ? doc.body_md.trim().split(/\s+/).filter(Boolean).length : 0
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [qaResults, setQaResults] = useState<QAResult[]>(doc.qa_results ?? []);
  const [currentStatus, setCurrentStatus] = useState(doc.status);

  const initialHtml = doc.body_md ? marked.parse(doc.body_md, { async: false }) : "";
  const status = STATUS_LABELS[currentStatus] ?? { label: currentStatus, variant: "outline" as const };
  const editable = currentStatus !== "exported" && currentStatus !== "killed";

  const flags = qaResults.filter((r) => r.level === "flag");
  const warns = qaResults.filter((r) => r.level === "warn");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const result = await updateDocument({ docId: doc.id, bodyMd, status: "in_review" });
      setQaResults(result.qaResults);
      setCurrentStatus(result.resolvedStatus);
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setSaving(true);
    try {
      const result = await updateDocument({ docId: doc.id, bodyMd, status: "approved" });
      setQaResults(result.qaResults);
      setCurrentStatus(result.resolvedStatus);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleKill() {
    if (!confirm("Mark this document as killed? It will be hidden from the active list.")) return;
    await updateDocument({ docId: doc.id, bodyMd, status: "killed" });
    router.push(`/clients/${clientId}/documents`);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(bodyMd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyHtml() {
    await navigator.clipboard.writeText(htmlRef.current);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
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
          <Button variant="ghost" size="sm" onClick={handleCopyHtml} title="Copy HTML (for CMS paste)">
            {copiedHtml ? <Check className="size-3.5 text-green-500" /> : <Code2 className="size-3.5" />}
          </Button>
          {editable && currentStatus !== "approved" && (
            <Button variant="outline" size="sm" onClick={handleApprove} disabled={saving}>
              Approve
            </Button>
          )}
          {editable && currentStatus !== "killed" && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleKill}>
              Kill
            </Button>
          )}
          {editable && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </Button>
          )}
        </div>
      </div>

      {/* QA results */}
      {qaResults.length > 0 && (
        <div className="space-y-1.5">
          {flags.map((r) => (
            <div key={r.rule} className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              {r.message}
            </div>
          ))}
          {warns.map((r) => (
            <div key={r.rule} className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              {r.message}
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground text-right">
        {wordCount.toLocaleString()} words
      </div>

      <TipTapEditor
        content={initialHtml}
        editable={editable}
        onChange={(html) => {
          htmlRef.current = html;
          const md = turndown.turndown(html);
          setBodyMd(md);
          setSaved(false);
        }}
        onChangeText={(text) => {
          setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
        }}
      />
    </div>
  );
}
