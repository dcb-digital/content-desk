"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProviderSettings } from "./actions";
import { toast } from "sonner";

// Anthropic and OpenAI: curated dropdown (stable IDs)
// OpenRouter: free text + datalist suggestions (they add models constantly)
//
// Every ID here is verified against the provider's own model list — a picker
// that offers a retired ID just produces a 404 at generation time. Rates for
// all of them live in src/lib/ai/pricing.ts. Checked 2026-08-05.
const ANTHROPIC_MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5 — most capable ✓ recommended" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — best balance" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fast & cheap (plans/QA)" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
];

const OPENAI_MODELS = [
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol — most capable" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra — balanced" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna — fast & cheap" },
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
];

// Suggestions only — the operator can type any valid OpenRouter model ID, and
// cost for whatever they type is priced from OpenRouter's live model list.
// Every ID below was checked against that list on 2026-08-05; 14 of the
// previous 36 had been retired and would have 404'd on first use.
// Note OpenRouter spells Anthropic IDs with dots, not dashes.
const OPENROUTER_SUGGESTIONS = [
  // Anthropic
  "anthropic/claude-opus-5",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-4.6",
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
  // OpenAI
  "openai/gpt-4.1",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/o3",
  "openai/o3-mini",
  "openai/o4-mini",
  // Google
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  // DeepSeek
  "deepseek/deepseek-v3.2",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-r1-0528",
  "deepseek/deepseek-chat-v3.1",
  // Meta
  "meta-llama/llama-3.3-70b-instruct",
  "meta-llama/llama-4-maverick",
  "meta-llama/llama-4-scout",
  // Mistral
  "mistralai/mistral-large-2512",
  "mistralai/mistral-medium-3",
  "mistralai/mistral-small-3.1-24b-instruct",
  "mistralai/codestral-2508",
  // xAI
  "x-ai/grok-4.5",
  "x-ai/grok-4.3",
  // Qwen
  "qwen/qwen3-235b-a22b",
  "qwen/qwen3-30b-a3b",
  "qwen/qwen3-32b",
  // Moonshot
  "moonshotai/kimi-k2.6",
  // Cohere
  "cohere/command-r-plus-08-2024",
  "cohere/command-r7b-12-2024",
  // Perplexity
  "perplexity/sonar-pro",
  "perplexity/sonar",
  // Microsoft
  "microsoft/phi-4",
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
