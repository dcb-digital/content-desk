"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCompletion } from "ai/react";
import { marked } from "marked";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TipTapEditor } from "@/components/editor/tiptap-editor";
import TurndownService from "turndown";
import { saveGeneratedDocument } from "./actions";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });

type Props = {
  clientId: string;
  disabled?: boolean;
  initialTitle?: string;
  initialKeyword?: string;
  planItemId?: string;
  /** When set, we're generating a draft from an approved brief */
  briefId?: string;
  initialBriefContent?: string;
  /** Pre-select a content type: "brief" | "post" | "page" | "refresh" */
  initialType?: string;
};

const TASK_KEYS: Record<string, string> = {
  post: "task_draft_post",
  page: "task_draft_page",
  refresh: "task_refresh",
  brief: "task_brief",
  draft_from_brief: "task_draft_from_brief",
};

export function GenerateForm({
  clientId,
  disabled,
  initialTitle,
  initialKeyword,
  planItemId,
  briefId,
  initialBriefContent,
  initialType,
}: Props) {
  const router = useRouter();
  const isBriefMode = Boolean(briefId);

  const [workingTitle, setWorkingTitle] = useState(initialTitle ?? "");
  const [targetKeyword, setTargetKeyword] = useState(initialKeyword ?? "");
  const [contentType, setContentType] = useState(
    isBriefMode ? "draft_from_brief" : (initialType ?? "post")
  );
  const [editorHtml, setEditorHtml] = useState<string>("");
  const [phase, setPhase] = useState<"form" | "streaming" | "editing">("form");
  const [saving, setSaving] = useState(false);
  const bodyMdRef = useRef("");

  const { complete, completion, isLoading } = useCompletion({
    api: "/api/generate",
    onResponse: () => {
      setPhase("streaming");
    },
    onFinish: async (_prompt, completionText) => {
      bodyMdRef.current = completionText;
      const html = await marked(completionText);
      setEditorHtml(html as string);
      setPhase("editing");
    },
    onError: (error) => {
      // Don't fail silently — a missing prompt key or unconfigured provider used
      // to just reset the form, which reads as "nothing happened"
      let message = error.message || "Generation failed.";
      try {
        const parsed = JSON.parse(message) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        // not JSON — use the raw message
      }
      toast.error(message);
      setPhase("form");
    },
  });

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!workingTitle.trim()) return;

    const taskKey = TASK_KEYS[contentType] ?? "task_draft_post";
    const taskVars: Record<string, string> = {
      workingTitle: workingTitle.trim(),
      targetKeyword: targetKeyword.trim(),
    };

    // When generating a draft from a brief, include the brief content
    if (contentType === "draft_from_brief" && initialBriefContent) {
      taskVars.briefContent = initialBriefContent;
    }

    await complete("", {
      body: {
        clientId,
        taskKey,
        taskVars,
      },
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const isBrief = contentType === "brief";
      const docId = await saveGeneratedDocument({
        clientId,
        title: workingTitle.trim(),
        bodyMd: bodyMdRef.current,
        planItemId,
        kind: isBrief ? "brief" : "draft",
      });
      router.push(`/clients/${clientId}/documents/${docId}`);
    } catch {
      setSaving(false);
    }
  }

  if (phase === "form") {
    return (
      <form onSubmit={handleGenerate} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="workingTitle">Working title</Label>
          <Input
            id="workingTitle"
            placeholder="e.g. Best Plumbers in Melbourne"
            value={workingTitle}
            onChange={(e) => setWorkingTitle(e.target.value)}
            disabled={disabled || isLoading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetKeyword">
            Target keyword{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="targetKeyword"
            placeholder="e.g. emergency plumber Melbourne"
            value={targetKeyword}
            onChange={(e) => setTargetKeyword(e.target.value)}
            disabled={disabled || isLoading}
          />
        </div>

        {!isBriefMode && (
          <div className="space-y-2">
            <Label htmlFor="contentType">Content type</Label>
            <select
              id="contentType"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              disabled={disabled || isLoading}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="post" className="bg-background">Blog post (draft)</option>
              <option value="page" className="bg-background">Service / location page (draft)</option>
              <option value="refresh" className="bg-background">Refresh existing page (draft)</option>
              <option value="brief" className="bg-background">Content brief</option>
            </select>
          </div>
        )}

        {isBriefMode && (
          <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 px-4 py-3">
            Generating a draft from your approved brief. The brief content will be used as context.
          </p>
        )}

        {planItemId && !isBriefMode && (
          <p className="text-xs text-muted-foreground">
            Linked to plan item — document will be connected to this plan.
          </p>
        )}

        <Button type="submit" disabled={disabled || !workingTitle.trim() || isLoading}>
          {contentType === "brief" ? "Generate brief" : "Generate draft"}
        </Button>
      </form>
    );
  }

  if (phase === "streaming") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          Generating…
        </div>
        <div className="rounded-lg border border-border bg-card px-6 py-5 min-h-[400px]">
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground">
            {completion || "Waiting for response…"}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Review and edit, then save.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPhase("form")}>
            Start over
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : contentType === "brief" ? "Save brief" : "Save draft"}
          </Button>
        </div>
      </div>

      <TipTapEditor
        content={editorHtml}
        editable
        onChange={(html) => {
          bodyMdRef.current = turndown.turndown(html);
        }}
      />
    </div>
  );
}
