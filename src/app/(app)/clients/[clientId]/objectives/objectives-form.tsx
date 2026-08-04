"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveObjectives } from "./actions";

const PRIMARY_GOALS = [
  { value: "more_enquiries", label: "More enquiries / leads" },
  { value: "brand_awareness", label: "Brand awareness" },
  { value: "ecommerce_sales", label: "Ecommerce sales" },
  { value: "local_visibility", label: "Local search visibility" },
  { value: "authority_content", label: "Authority / thought leadership" },
  { value: "other", label: "Other" },
];

type ObjectivesData = {
  primaryGoal: string;
  successMetric: string;
  numericTarget?: number | null;
  priorityServices: string[];
  priorityLocations: string[];
  audienceNotes?: string;
  constraints?: string;
  freeText?: string;
};

type Props = {
  clientId: string;
  current?: {
    data: ObjectivesData;
    summary_md: string;
  } | null;
};

export function ObjectivesForm({ clientId, current }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const d = current?.data;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await saveObjectives(clientId, fd);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1 */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          1 · Goal
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="primaryGoal">Primary business goal</Label>
          <select
            id="primaryGoal"
            name="primaryGoal"
            defaultValue={d?.primaryGoal ?? "more_enquiries"}
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {PRIMARY_GOALS.map((g) => (
              <option key={g.value} value={g.value} className="bg-background">
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* Step 2 */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          2 · Success metric
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="successMetric">
            How does the client measure success? (in their words)
          </Label>
          <Input
            id="successMetric"
            name="successMetric"
            defaultValue={d?.successMetric}
            placeholder="e.g. Qualified enquiries for property settlement matters"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="numericTarget">
            Numeric target{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="numericTarget"
            name="numericTarget"
            type="number"
            defaultValue={d?.numericTarget ?? ""}
            placeholder="e.g. 8 per month"
            className="max-w-xs"
          />
        </div>
      </fieldset>

      {/* Step 3 */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          3 · Priority services
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="priorityServices">
            Which services should content prioritise?
          </Label>
          <textarea
            id="priorityServices"
            name="priorityServices"
            rows={3}
            defaultValue={d?.priorityServices?.join("\n") ?? ""}
            placeholder="One per line, e.g.&#10;Property settlement&#10;Parenting arrangements"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </fieldset>

      {/* Step 4 */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          4 · Priority locations
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="priorityLocations">
            Key service areas or locations
          </Label>
          <textarea
            id="priorityLocations"
            name="priorityLocations"
            rows={3}
            defaultValue={d?.priorityLocations?.join("\n") ?? ""}
            placeholder="One per line, e.g.&#10;Brisbane CBD&#10;North Brisbane"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </fieldset>

      {/* Step 5 */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          5 · Audience
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="audienceNotes">
            Who is this client's ideal customer?
          </Label>
          <textarea
            id="audienceNotes"
            name="audienceNotes"
            rows={3}
            defaultValue={d?.audienceNotes ?? ""}
            placeholder="Age, situation, search behaviour, pain points…"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </fieldset>

      {/* Step 6 */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          6 · Constraints
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="constraints">
            Legal, compliance, or topic restrictions
          </Label>
          <textarea
            id="constraints"
            name="constraints"
            rows={3}
            defaultValue={d?.constraints ?? ""}
            placeholder="e.g. Legal content rules — no outcome guarantees, always include disclaimer"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </fieldset>

      {/* Step 7 */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          7 · Anything else
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="freeText">
            Additional context for the AI
          </Label>
          <textarea
            id="freeText"
            name="freeText"
            rows={3}
            defaultValue={d?.freeText ?? ""}
            placeholder="Priorities, pet peeves, upcoming campaigns…"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </fieldset>

      {/* Summary (auto-generated, editable) */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Summary paragraph
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="summaryMd">
            Objectives summary{" "}
            <span className="text-muted-foreground font-normal">
              — auto-generated on save if left blank; injected into every prompt
            </span>
          </Label>
          <textarea
            id="summaryMd"
            name="summaryMd"
            rows={4}
            defaultValue={current?.summary_md ?? ""}
            placeholder="Leave blank to auto-generate from the fields above…"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </fieldset>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : current ? "Update objectives" : "Save objectives"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/clients/${clientId}`)}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
