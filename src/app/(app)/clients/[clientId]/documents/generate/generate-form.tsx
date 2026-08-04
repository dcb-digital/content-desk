"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCompletion } from "ai/react";
import { marked } from "marked";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TipTapEditor } from "@/components/editor/tiptap-editor";
import { saveGeneratedDocument } from "./actions";

type Props = {
  clientId: string;
  disabled?: boolean;
};

export function GenerateForm({ clientId, disabled }: Props) {
  const router = useRouter();
  const [workingTitle, setWorkingTitle] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
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
    onError: () => {
      setPhase("form");
    },
  });

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!workingTitle.trim()) return;

    await complete("", {
      body: {
        clientId,
        taskKey: "task_draft_post",
        taskVars: {
          workingTitle: workingTitle.trim(),
          targetKeyword: targetKeyword.trim(),
        },
      },
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const docId = await saveGeneratedDocument({
        clientId,
        title: workingTitle.trim(),
        bodyMd: bodyMdRef.current,
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

        <Button type="submit" disabled={disabled || !workingTitle.trim() || isLoading}>
          Generate draft
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
          Review and edit your draft, then save it.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPhase("form")}>
            Start over
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </div>

      <TipTapEditor
        content={editorHtml}
        editable
        onChange={(text) => {
          bodyMdRef.current = text;
        }}
      />
    </div>
  );
}
