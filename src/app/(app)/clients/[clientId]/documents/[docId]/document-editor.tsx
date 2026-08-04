"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import TurndownService from "turndown";
import { TipTapEditor, type TipTapEditorHandle } from "@/components/editor/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { updateDocument, getDocumentVersions, restoreVersion } from "./actions";
import {
  Copy, Check, Download, AlertTriangle, Info, Code2,
  Wand2, History, RotateCcw, Loader2,
} from "lucide-react";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });

type QAResult = {
  rule: string;
  level: "flag" | "warn";
  message: string;
};

type DocVersion = {
  id: string;
  version: number;
  author: string;
  created_at: string;
  body_md: string;
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
  briefed: { label: "Briefed", variant: "secondary" },
  brief_approved: { label: "Brief approved", variant: "secondary" },
  drafting: { label: "Drafting", variant: "secondary" },
  in_review: { label: "In review", variant: "default" },
  qa_flagged: { label: "QA flagged", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  exported: { label: "Exported", variant: "outline" },
  killed: { label: "Killed", variant: "outline" },
};

function toHtml(md: string | null): string {
  if (!md) return "";
  return marked.parse(md, { async: false }) as string;
}

type Props = { doc: Doc; clientId: string };

export function DocumentEditor({ doc, clientId }: Props) {
  const router = useRouter();
  const editorRef = useRef<TipTapEditorHandle>(null);

  const [bodyMd, setBodyMd] = useState(doc.body_md ?? "");
  const [editorHtml, setEditorHtml] = useState(() => toHtml(doc.body_md));
  const htmlRef = useRef<string>(toHtml(doc.body_md));
  const [wordCount, setWordCount] = useState(() =>
    doc.body_md ? doc.body_md.trim().split(/\s+/).filter(Boolean).length : 0
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [qaResults, setQaResults] = useState<QAResult[]>(doc.qa_results ?? []);
  const [currentStatus, setCurrentStatus] = useState(doc.status);

  // Section rewrite
  const [hasSelection, setHasSelection] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const pendingRangeRef = useRef<{ from: number; to: number } | null>(null);

  // Version history
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const status = STATUS_LABELS[currentStatus] ?? { label: currentStatus, variant: "outline" as const };
  const isBrief = doc.kind === "brief";
  const editable = currentStatus !== "exported" && currentStatus !== "killed";

  const flags = qaResults.filter((r) => r.level === "flag");
  const warns = qaResults.filter((r) => r.level === "warn");

  async function handleSave(targetStatus?: string) {
    const resolveStatus = targetStatus ?? (isBrief ? "briefed" : "in_review");
    setSaving(true);
    setSaved(false);
    try {
      const result = await updateDocument({ docId: doc.id, bodyMd, status: resolveStatus });
      setQaResults(result.qaResults);
      setCurrentStatus(result.resolvedStatus);
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveBrief() {
    setSaving(true);
    try {
      await updateDocument({ docId: doc.id, bodyMd, status: "brief_approved" });
      setCurrentStatus("brief_approved");
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

  function handleOpenRewrite() {
    const range = editorRef.current?.getSelectionRange();
    if (!range) return;
    pendingRangeRef.current = range;
    setRewriteInstruction("");
    setRewriteOpen(true);
  }

  async function handleRewrite() {
    const range = pendingRangeRef.current;
    if (!range || !rewriteInstruction.trim()) return;
    const selectedText = editorRef.current?.getSelectedText() ?? "";
    if (!selectedText.trim()) return;

    setRewriting(true);
    try {
      const res = await fetch("/api/section-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, selectedText, instruction: rewriteInstruction.trim() }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        alert(err.error ?? "Rewrite failed");
        return;
      }
      const { text } = await res.json() as { text: string };
      editorRef.current?.replaceRange(range.from, range.to, text);
      setRewriteOpen(false);
    } finally {
      setRewriting(false);
    }
  }

  async function handleOpenHistory() {
    setShowHistory(true);
    if (versions.length === 0) {
      setLoadingVersions(true);
      try {
        const v = await getDocumentVersions(doc.id);
        setVersions(v as DocVersion[]);
      } finally {
        setLoadingVersions(false);
      }
    }
  }

  async function handleRestore(v: DocVersion) {
    if (!confirm(`Restore to version ${v.version}?`)) return;
    await restoreVersion(doc.id, v.body_md, v.version);
    const html = toHtml(v.body_md);
    setEditorHtml(html);
    setBodyMd(v.body_md);
    setShowHistory(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{doc.title}</h2>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doc.kind} ·{" "}
            {new Date(doc.updated_at).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="ghost" size="sm" onClick={handleDownload} title="Download .md">
            <Download className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} title="Copy markdown">
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopyHtml} title="Copy HTML">
            {copiedHtml ? <Check className="size-3.5 text-green-500" /> : <Code2 className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenHistory}
            title="Version history"
          >
            <History className="size-3.5" />
          </Button>
          {editable && hasSelection && (
            <Button variant="outline" size="sm" onClick={handleOpenRewrite} title="Rewrite selection with AI">
              <Wand2 className="size-3.5 mr-1.5" />
              Rewrite
            </Button>
          )}
          {/* Brief-specific actions */}
          {isBrief && editable && currentStatus === "briefed" && (
            <Button variant="outline" size="sm" onClick={handleApproveBrief} disabled={saving}>
              Approve brief
            </Button>
          )}
          {isBrief && currentStatus === "brief_approved" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`/clients/${clientId}/documents/generate?briefId=${doc.id}&title=${encodeURIComponent(doc.title)}&briefContent=${encodeURIComponent(bodyMd)}`)}
            >
              Generate draft →
            </Button>
          )}
          {/* Draft actions */}
          {!isBrief && editable && currentStatus !== "approved" && (
            <Button variant="outline" size="sm" onClick={handleApprove} disabled={saving}>
              Approve
            </Button>
          )}
          {editable && currentStatus !== "killed" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleKill}
            >
              Kill
            </Button>
          )}
          {editable && (
            <Button size="sm" onClick={() => handleSave()} disabled={saving}>
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

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <TipTapEditor
            ref={editorRef}
            content={editorHtml}
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
            onSelectionUpdate={setHasSelection}
          />
        </div>

        {/* Version history panel */}
        {showHistory && (
          <div className="w-64 shrink-0 rounded-lg border border-border bg-card p-4 space-y-3 self-start sticky top-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Version history</p>
              <button
                onClick={() => setShowHistory(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>
            {loadingVersions ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </div>
            ) : versions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved versions yet.</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="rounded-md border border-border p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">v{v.version}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString("en-AU", {
                          day: "numeric", month: "short",
                        })}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRestore(v)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <RotateCcw className="size-3" />
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section rewrite dialog */}
      <Dialog open={rewriteOpen} onOpenChange={setRewriteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rewrite selection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <p className="text-xs text-muted-foreground">
              Describe how to rewrite the selected text. The AI will replace it inline.
            </p>
            <Textarea
              placeholder="e.g. Make this more concise · Use a friendlier tone · Add a statistic"
              value={rewriteInstruction}
              onChange={(e) => setRewriteInstruction(e.target.value)}
              className="resize-none h-20 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRewrite();
              }}
            />
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button type="button" variant="outline" size="sm">Cancel</Button>} />
              <Button
                size="sm"
                onClick={handleRewrite}
                disabled={rewriting || !rewriteInstruction.trim()}
              >
                {rewriting ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    Rewriting…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-3.5 mr-1.5" />
                    Rewrite
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
