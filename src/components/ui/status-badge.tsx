/**
 * One source of truth for every status in the app.
 *
 * The document pipeline is the spine of Content Desk, so it should look the same
 * everywhere it appears — list, editor header, plan row. Previously each screen
 * kept its own `STATUS_LABELS` map with grey-only shadcn variants, so the pipeline
 * was invisible.
 *
 * Tone is assigned by *what the human has to do*, not by position in the pipeline:
 * only `in_review` (and an open opportunity) carries the brand colour, because
 * those are the two things that actually want attention.
 */
import { cn } from "@/lib/utils";

type Tone = "brand" | "info" | "warning" | "success" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  brand: "border-brand/25 bg-brand-subtle text-brand",
  info: "border-info/25 bg-info-subtle text-info",
  warning: "border-warning/30 bg-warning-subtle text-warning",
  success: "border-success/25 bg-success-subtle text-success",
  neutral: "border-border bg-muted/40 text-muted-foreground",
};

const DOT_CLASS: Record<Tone, string> = {
  brand: "bg-brand",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
  neutral: "bg-muted-foreground/50",
};

const STATUSES: Record<string, { label: string; tone: Tone }> = {
  // Document pipeline
  planned: { label: "Planned", tone: "neutral" },
  briefed: { label: "Briefed", tone: "info" },
  brief_approved: { label: "Brief approved", tone: "info" },
  drafting: { label: "Drafting", tone: "info" },
  in_review: { label: "In review", tone: "brand" },
  qa_flagged: { label: "QA flagged", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  exported: { label: "Exported", tone: "neutral" },
  published: { label: "Published", tone: "success" },
  killed: { label: "Killed", tone: "neutral" },

  // Opportunities
  open: { label: "Open", tone: "brand" },
  dismissed: { label: "Dismissed", tone: "neutral" },

  // Plans
  draft: { label: "Draft", tone: "info" },
  archived: { label: "Archived", tone: "neutral" },
};

/** Humanises an unmapped status rather than printing a raw enum value. */
function fallback(status: string) {
  return {
    label: status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
    tone: "neutral" as Tone,
  };
}

export function StatusBadge({
  status,
  className,
  showDot = true,
}: {
  status: string;
  className?: string;
  showDot?: boolean;
}) {
  const { label, tone } = STATUSES[status] ?? fallback(status);

  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-md border px-1.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {showDot && <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} />}
      {label}
    </span>
  );
}

/** Exported so filter tabs and pickers can share the same labels. */
export function statusLabel(status: string): string {
  return (STATUSES[status] ?? fallback(status)).label;
}
