"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inngest, BATCH_DRAFT_EVENT, type BatchDraftEventData } from "@/inngest/client";
import { nextActionForItem, type PlanItemType } from "@/lib/ai/generate-document";
import type { BatchRunItem } from "@/db/schema";

async function requireWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) throw new Error("No workspace");

  return { supabase, user, workspaceId: membership.workspace_id as string };
}

/** The approval gate the brief puts in front of batch drafting (§6.5). */
export async function approvePlan(planId: string, clientId: string) {
  const { supabase, user } = await requireWorkspace();

  const { error } = await supabase
    .from("content_plans")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("client_id", clientId);

  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}/plans/${planId}`);
}

/**
 * Queues a batch run for every item that has a next step, then hands off to
 * Inngest. The row is written first so a send failure is visible as a failed
 * run rather than a button that did nothing.
 */
export async function startBatchDraft(planId: string, clientId: string) {
  const { supabase, user, workspaceId } = await requireWorkspace();

  const { data: plan } = await supabase
    .from("content_plans")
    .select("status")
    .eq("id", planId)
    .eq("client_id", clientId)
    .single();

  if (!plan) throw new Error("Plan not found");
  if (plan.status !== "approved") {
    throw new Error("Approve the plan before batch drafting.");
  }

  const { data: client } = await supabase
    .from("clients")
    .select("brief_gate_enabled")
    .eq("id", clientId)
    .single();

  const { data: rows } = await supabase
    .from("plan_items")
    .select("id, type, working_title, status")
    .eq("plan_id", planId)
    .order("scheduled_date", { ascending: true });

  const briefGateEnabled = client?.brief_gate_enabled ?? true;
  const items = (rows ?? [])
    .map((row): BatchRunItem | null => {
      const action = nextActionForItem(row.status as string, briefGateEnabled);
      if (!action) return null;
      return {
        planItemId: row.id as string,
        workingTitle: row.working_title as string,
        type: row.type as PlanItemType,
        action,
        status: "pending",
      };
    })
    .filter((i): i is BatchRunItem => i !== null);

  if (items.length === 0) {
    throw new Error("Nothing to generate — every item is already briefed or drafted.");
  }

  const { data: run, error } = await supabase
    .from("batch_runs")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      plan_id: planId,
      status: "queued",
      total: items.length,
      items,
      started_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const batchRunId = run.id as string;

  const payload: BatchDraftEventData = {
    batchRunId,
    workspaceId,
    clientId,
    planId,
    userId: user.id,
  };

  try {
    await inngest.send({ name: BATCH_DRAFT_EVENT, data: payload });
  } catch (err) {
    // Most often: no Inngest Dev Server locally, or no INNGEST_EVENT_KEY in prod.
    // Say that plainly instead of leaving a run stuck on "queued" forever.
    const reason = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("batch_runs")
      .update({
        status: "failed",
        error: `Couldn't reach Inngest: ${reason}`,
        finished_at: new Date().toISOString(),
      })
      .eq("id", batchRunId);
    throw new Error(
      `Couldn't queue the batch — Inngest is unreachable. Locally, run \`npx inngest-cli@latest dev\`; in production set INNGEST_EVENT_KEY. (${reason})`,
    );
  }

  revalidatePath(`/clients/${clientId}/plans/${planId}`);
  return batchRunId;
}

/** Polled by the progress panel while a run is in flight. */
export async function getBatchRun(batchRunId: string) {
  const { supabase } = await requireWorkspace();

  const { data } = await supabase
    .from("batch_runs")
    .select("id, status, total, succeeded, failed, items, error, started_at, finished_at")
    .eq("id", batchRunId)
    .single();

  return data;
}

/** The run shown when the page loads — latest for this plan, if any. */
export async function getLatestBatchRun(planId: string) {
  const { supabase } = await requireWorkspace();

  const { data } = await supabase
    .from("batch_runs")
    .select("id, status, total, succeeded, failed, items, error, started_at, finished_at")
    .eq("plan_id", planId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
