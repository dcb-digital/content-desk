"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProviderSettings } from "./actions";
import { toast } from "sonner";

type Props = {
  providerModels: Record<string, string[]>;
  defaultProvider: string;
};

export function SettingsForm({ providerModels, defaultProvider }: Props) {
  const [provider, setProvider] = useState(defaultProvider);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const models = providerModels[provider] ?? [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await saveProviderSettings(fd);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Provider saved successfully");
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
      const json = await res.json();
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
          <option value="openrouter" className="bg-background">OpenRouter</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="apiKey">API key</Label>
        <div className="relative">
          <Input
            id="apiKey"
            name="apiKey"
            type={showKey ? "text" : "password"}
            placeholder={
              provider === "anthropic"
                ? "sk-ant-…"
                : provider === "openai"
                ? "sk-…"
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

      <div className="space-y-1.5">
        <Label htmlFor="model">Default model for this provider</Label>
        <select
          id="model"
          name="model"
          defaultValue={models[0] ?? ""}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {models.map((m) => (
            <option key={m} value={m} className="bg-background">
              {m}
            </option>
          ))}
        </select>
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
