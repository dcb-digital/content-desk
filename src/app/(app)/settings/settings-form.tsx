"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProviderSettings } from "./actions";
import { toast } from "sonner";

// Anthropic and OpenAI: curated dropdown (stable IDs)
// OpenRouter: free text + datalist suggestions (they add models constantly)
const ANTHROPIC_MODELS = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6 — most capable" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — best balance ✓ recommended" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fast & cheap (plans/QA)" },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
];

const OPENAI_MODELS = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o mini — fast & cheap" },
  { id: "o3", label: "o3 — reasoning" },
  { id: "o3-mini", label: "o3-mini — reasoning, cheaper" },
  { id: "o4-mini", label: "o4-mini" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
];

// Suggestions only — user can type any valid OpenRouter model ID
const OPENROUTER_SUGGESTIONS = [
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-opus-4-6",
  "anthropic/claude-haiku-4-5",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/o3",
  "openai/o3-mini",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct",
  "meta-llama/llama-3.1-405b-instruct",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-chat-v3-5",
  "qwen/qwen-2.5-72b-instruct",
  "qwen/qvq-72b-preview",
  "mistralai/mistral-large-2411",
  "mistralai/mistral-small-3.1-24b-instruct",
  "x-ai/grok-3-mini-beta",
  "x-ai/grok-3-beta",
];

type Props = {
  defaultProvider: string;
};

export function SettingsForm({ defaultProvider }: Props) {
  const [provider, setProvider] = useState(defaultProvider);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await saveProviderSettings(fd);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Provider saved");
      (e.target as HTMLFormElement).reset();
      setShowKey(false);
    }
    setLoading(false);
  }

  async function handleTest(e: React.MouseEvent) {
    e.preventDefault();
    setTesting(true);
    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (json.ok) {
        toast.success(`Connected to ${provider}`);
      } else {
        toast.error(json.error ?? "Connection failed");
      }
    } catch {
      toast.error("Request failed");
    }
    setTesting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-5 space-y-5">
      <p className="text-sm font-medium">Add / update a provider</p>

      {/* Provider */}
      <div className="space-y-1.5">
        <Label htmlFor="provider">Provider</Label>
        <select
          id="provider"
          name="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="anthropic" className="bg-background">Anthropic</option>
          <option value="openai" className="bg-background">OpenAI</option>
          <option value="openrouter" className="bg-background">OpenRouter (recommended — every model)</option>
        </select>
      </div>

      {/* API key */}
      <div className="space-y-1.5">
        <Label htmlFor="apiKey">API key</Label>
        <div className="relative">
          <Input
            id="apiKey"
            name="apiKey"
            type={showKey ? "text" : "password"}
            placeholder={
              provider === "anthropic" ? "sk-ant-…"
              : provider === "openai" ? "sk-…"
              : "sk-or-…"
            }
            required
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* Model — dropdown for Anthropic/OpenAI, free text for OpenRouter */}
      <div className="space-y-1.5">
        <Label htmlFor="model">
          Default model
          {provider === "openrouter" && (
            <span className="ml-1.5 font-normal text-muted-foreground text-xs">
              — type any OpenRouter model ID, e.g. <code>anthropic/claude-sonnet-4-6</code>
            </span>
          )}
        </Label>

        {provider === "anthropic" && (
          <select
            key="anthropic-model"
            id="model"
            name="model"
            defaultValue="claude-sonnet-4-6"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {ANTHROPIC_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-background">
                {m.label}
              </option>
            ))}
          </select>
        )}

        {provider === "openai" && (
          <select
            key="openai-model"
            id="model"
            name="model"
            defaultValue="gpt-4o"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {OPENAI_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-background">
                {m.label}
              </option>
            ))}
          </select>
        )}

        {provider === "openrouter" && (
          <>
            <Input
              key="openrouter-model"
              id="model"
              name="model"
              list="openrouter-suggestions"
              placeholder="anthropic/claude-sonnet-4-6"
              defaultValue="anthropic/claude-sonnet-4-6"
              required
              className="font-mono text-sm"
            />
            <datalist id="openrouter-suggestions">
              {OPENROUTER_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Full list at{" "}
              <span className="font-mono">openrouter.ai/models</span>
            </p>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save provider"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? "Testing…" : "Test connection"}
        </Button>
      </div>
    </form>
  );
}
