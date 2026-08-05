"use client";

/**
 * Approval gate + batch drafting controls and progress (brief §6.6).
 *
 * The run row in the database is the progress display's source of truth, not
 * this component's state — the whole point of the batch is that you can close
 * the laptop, and the panel has to be able to reconstruct where things got to
 * from a cold page load.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { approvePlan, startBatchDraft, getBatchRun } from "./actions";
import type { BatchRunItem } from "@/db/schema";
import { AlertTriangle, Check, Loader2, Play } from "lucide-react";

const POLL_MS = 2000;

export type BatchRun = {
  id: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  items: BatchRunItem[];
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

type Props = {
  planId: string;
  clientId: string;
  planStatus: string;
  /** Items with a next step — what the button will actually generate. */
  eligibleCount: number;
  initialRun: BatchRun | null;
};

const ITEM_TONE: Record<BatchRunItem["status"], string> = {
  pending: "text-muted-foreground",
  running: "text-info",
  done: "text-success",
  failed: "text-destructive",
};

export function BatchPanel({ planId, clientId, planStatus, eligibleCount, initialRun }: Props) {
  const router = useRouter();
  const [run, setRun] = useState<BatchRun | null>(initialRun);
  const [pending, startTransition] = useTransition();
  const [starting, setStarting] = useState(false);

  const inFlight = run !== null && (run.status === "queued" || run.status === "running");

  useEffect(() => {
    if (!inFlight || !run) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      const next = await getBatchRun(run.id);
      if (cancelled || !next) return;
      setRun(next as BatchRun);
      if (next.status !== "queued" && next.status !== "running") {
        // Plan item statuses moved underneath us — pull the fresh list.
        router.refresh();
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [inFlight, run, router]);

  function handleApprove() {
    startTransition(async () => {
      try {
        await approvePlan(planId, clientId);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't approve the plan.");
      }
    });
  }

  async function handleStart() {
    setStarting(true);
    try {
      const runId = await startBatchDraft(planId, clientId);
      const fresh = await getBatchRun(runId);
      if (fresh) setRun(fresh as BatchRun);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the batch.", {
        duration: 10000,
      });
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {planStatus === "draft" && (
          <Button size="sm" onClick={handleApprove} disabled={pending}>
            {pending ? "Approving…" : "Approve plan"}
          </Button>
        )}

        {planStatus === "approved" && (
          <Button
            size="sm"
            onClick={handleStart}
            disabled={starting || inFlight || eligibleCount === 0}
            title={eligibleCount === 0 ? "Every item is already briefed or drafted" : undefined}
          >
            {starting || inFlight ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="size-3.5 mr-1.5" />
            )}
            {inFlight
              ? "Drafting…"
              : eligibleCount === 0
                ? "Nothing left to draft"
                : `Draft all ${eligibleCount} item${eligibleCount === 1 ? "" : "s"}`}
          </Button>
        )}

        {planStatus === "approved" && !inFlight && eligibleCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Runs in the background — you can close this tab.
          </p>
        )}
      </div>

      {run && <RunProgress run={run} clientId={clientId} />}
    </div>
  );
}

function RunProgress({ run, clientId }: { run: BatchRun; clientId: string }) {
  const done = run.items.filter((i) => i.status === "done" || i.status === "failed").length;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          {run.status === "running" || run.status === "queued" ? (
            <Loader2 className="size-3.5 animate-spin text-info" />
          ) : run.failed > 0 ? (
            <AlertTriangle className="size-3.5 text-warning" />
          ) : (
            <Check className="size-3.5 text-success" />
          )}
          <span className="text-xs font-medium">
            {run.status === "queued" && "Queued"}
            {run.status === "running" && `Drafting ${done + 1} of ${run.total}`}
            {run.status === "completed" &&
              `Finished — ${run.succeeded} of ${run.total} generated${run.failed > 0 ? `, ${run.failed} failed` : ""}`}
            {run.status === "failed" && "Batch failed to start"}
          </span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {done}/{run.total}
        </span>
      </div>

      {run.error && (
        <p className="border-b border-border px-4 py-2 text-xs text-destructive">{run.error}</p>
      )}

      <ul className="divide-y divide-border">
        {run.items.map((item) => (
          <li key={item.planItemId} className="flex items-center gap-3 px-4 py-2">
            <span className={cn("w-14 shrink-0 text-xs font-medium", ITEM_TONE[item.status])}>
              {item.status === "running" ? "running" : item.status}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs">{item.workingTitle}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{item.action}</span>
            {item.documentId && (
              <Link
                href={`/clients/${clientId}/documents/${item.documentId}`}
                className="shrink-0 text-xs text-primary hover:underline"
              >
                Open
              </Link>
            )}
            {item.error && (
              <span className="max-w-[40%] shrink-0 truncate text-xs text-destructive" title={item.error}>
                {item.error}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
