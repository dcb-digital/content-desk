"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClientAction } from "../actions";

const LOCALE_OPTIONS = [
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-NZ", label: "English (New Zealand)" },
];

export default function NewClientPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createClientAction(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // On success, createClientAction redirects to /clients
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="/clients"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-4 inline-flex")}
        >
          <ArrowLeft className="size-4 mr-1.5" />
          Clients
        </Link>
        <h1 className="text-2xl font-semibold">New client</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          You can add knowledge, objectives, and evidence after creating the
          client.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Acme Legal Group"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain">Website domain</Label>
              <Input
                id="domain"
                name="domain"
                placeholder="acmelegal.com.au"
                type="text"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry / vertical</Label>
              <Input
                id="industry"
                name="industry"
                placeholder="Family law"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="locale">Content locale</Label>
              <select
                id="locale"
                name="locale"
                defaultValue="en-AU"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-background">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Internal notes about this client…"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create client"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/clients")}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
