"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { savePrompt } from "./actions";
import { ChevronDown, ChevronRight } from "lucide-react";

type Prompt = {
  id: string;
  key: string;
  version: number;
  body: string;
  notes: string | null;
  is_active: boolean;
};

export function PromptEditor({ prompt }: { prompt: Prompt }) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState(prompt.body);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = body !== prompt.body;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await savePrompt(prompt.id, body);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium">{prompt.key}</p>
          {prompt.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{prompt.notes}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">v{prompt.version}</span>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/10">
          <Textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); setSaved(false); }}
            rows={Math.min(Math.max(body.split("\n").length + 2, 6), 30)}
            className="font-mono text-xs resize-y"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {body.length} chars · editing will bump to v{prompt.version + 1}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setBody(prompt.body); setSaved(false); }}
                disabled={!dirty || saving}
              >
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
