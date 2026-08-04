"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DOC_TYPES = [
  { value: "brand_voice", label: "Brand voice" },
  { value: "services", label: "Services" },
  { value: "offers", label: "Offers" },
  { value: "locations", label: "Locations" },
  { value: "icp", label: "ICP (ideal customer)" },
  { value: "proof_case_studies", label: "Proof & case studies" },
  { value: "banned_claims", label: "Banned claims" },
  { value: "competitors", label: "Competitors" },
  { value: "product_facts", label: "Product facts" },
  { value: "other", label: "Other" },
];

type Props = {
  clientId: string;
  action: (formData: FormData) => Promise<{ error: string } | undefined>;
  defaultValues?: {
    title?: string;
    type?: string;
    bodyMd?: string;
    pinned?: boolean;
  };
  heading: string;
};

export function DocForm({ clientId, action, defaultValues = {}, heading }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pinned, setPinned] = useState(defaultValues.pinned ?? false);
  const [bodyMd, setBodyMd] = useState(defaultValues.bodyMd ?? "");
  const tokenEstimate = Math.ceil(bodyMd.length / 4);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    fd.set("pinned", String(pinned));
    fd.set("bodyMd", bodyMd);
    const result = await action(fd);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/clients/${clientId}/knowledge`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-4 inline-flex")}
        >
          <ArrowLeft className="size-4 mr-1.5" />
          Knowledge
        </Link>
        <h2 className="text-lg font-semibold">{heading}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={defaultValues.title}
            placeholder="e.g. Brand voice"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue={defaultValues.type ?? "other"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-background">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="bodyMd">Content (markdown)</Label>
            <span className="text-xs text-muted-foreground">
              ~{tokenEstimate.toLocaleString()} tokens
              {tokenEstimate > 2000 && (
                <span className="text-yellow-500 ml-1">
                  {pinned ? "· over pinned budget" : ""}
                </span>
              )}
            </span>
          </div>
          <textarea
            id="bodyMd"
            name="bodyMd"
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            rows={16}
            placeholder="Write in markdown…"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={pinned}
            onClick={() => setPinned(!pinned)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              pinned ? "bg-primary" : "bg-input",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform",
                pinned ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
          <Label
            onClick={() => setPinned(!pinned)}
            className="cursor-pointer select-none"
          >
            Pin to every generation
            <span className="ml-1.5 text-muted-foreground font-normal">
              — always included in prompts
            </span>
          </Label>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save doc"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/clients/${clientId}/knowledge`)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
