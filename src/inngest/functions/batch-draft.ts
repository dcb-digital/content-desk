/**
 * "Draft all items" (brief §6.6) — sequential, resumable, per-item failure isolation.
 *
 * Each item is its own `step.run`, so Inngest checkpoints after every one: a
 * deploy, timeout or crash mid-batch resumes at the next unfinished item rather
 * than regenerating (and re-billing) the ones already done.
 *
 * Failure isolation is deliberate about *where* errors are caught. A step that
 * throws gets retried and then fails the whole run, which is right for "the
 * workspace has no API key" and wrong for "article three tripped a content
 * filter". So item errors are caught inside the step and recorded as data —
 * the step succeeds, the run continues, and the operator sees which item failed
 * and why (acceptance test #4).
 */
import { inngest, BATCH_DRAFT_EVENT, type BatchDraftEventData } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateForPlanItem, type PlanItemType } from "@/lib/ai/generate-document";
import type { BatchRunItem } from "@/db/schema";

export const batchDraft = inngest.createFunction(
  {
    id: "batch-draft-plan",
    name: "Batch draft plan items",
    // One batch per workspace at a time: these runs are long and token-hungry,
    // and two at once would race on the same client's plan items.
    concurrency: { limit: 1, key: "event.data.workspaceId" },
    retries: 2,
    // v4 takes triggers inside the options object, not as a second argument.
    triggers: [{ event: BATCH_DRAFT_EVENT }],
  },
  async ({ event, step, logger }) => {
    const { batchRunId, workspaceId, clientId, planId, userId } = event.data as BatchDraftEventData;
    const supabase = createAdminClient();

    const setup = await step.run("load-run", async () => {
      const { data: run } = await supabase
        .from("batch_runs")
        .select("items, status")
        .eq("id", batchRunId)
        .eq("workspace_id", workspaceId)
        .single();
      if (!run) throw new Error(`Batch run ${batchRunId} not found`);

      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .eq("workspace_id", workspaceId)
        .single();
      if (!client) throw new Error(`Client ${clientId} not found`);

      await supabase
        .from("batch_runs")
        .update({ status: "running" })
        .eq("id", batchRunId)
        .eq("workspace_id", workspaceId);

      return {
        items: (run.items ?? []) as BatchRunItem[],
        clientName: client.name as string,
      };
    });

    for (const item of setup.items) {
      // Resumed runs skip what already finished — the row is the source of truth,
      // not the loop index.
      if (item.status === "done" || item.status === "failed") continue;

      await step.run(`item-${item.planItemId}`, async () => {
        await patchItem(batchRunId, workspaceId, item.planItemId, { status: "running" });

        try {
          const { data: planItem } = await supabase
            .from("plan_items")
            .select("id, type, working_title, target_keyword, target_url, scheduled_date, status")
            .eq("id", item.planItemId)
            .eq("workspace_id", workspaceId)
            .single();

          if (!planItem) throw new Error("Plan item no longer exists");

          const result = await generateForPlanItem({
            supabase,
            workspaceId,
            clientId,
            clientName: setup.clientName,
            planItem: {
              id: planItem.id as string,
              type: planItem.type as PlanItemType,
              workingTitle: planItem.working_title as string,
              targetKeyword: (planItem.target_keyword as string | null) ?? null,
              targetUrl: (planItem.target_url as string | null) ?? null,
              scheduledDate: (planItem.scheduled_date as string | null) ?? null,
            },
            action: item.action,
            userId,
          });

          await patchItem(batchRunId, workspaceId, item.planItemId, {
            status: "done",
            documentId: result.documentId,
          });
          return { ok: true as const, documentId: result.documentId };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Generation failed";
          logger.error(`batch item ${item.planItemId} failed: ${message}`);
          // Recorded, not thrown — the rest of the batch still runs.
          await patchItem(batchRunId, workspaceId, item.planItemId, {
            status: "failed",
            error: message,
          });
          return { ok: false as const, error: message };
        }
      });
    }

    return await step.run("finalise", async () => {
      const { data: run } = await supabase
        .from("batch_runs")
        .select("items")
        .eq("id", batchRunId)
        .eq("workspace_id", workspaceId)
        .single();

      const items = (run?.items ?? []) as BatchRunItem[];
      const succeeded = items.filter((i) => i.status === "done").length;
      const failed = items.filter((i) => i.status === "failed").length;

      await supabase
        .from("batch_runs")
        .update({
          status: "completed",
          succeeded,
          failed,
          finished_at: new Date().toISOString(),
        })
        .eq("id", batchRunId)
        .eq("workspace_id", workspaceId);

      return { succeeded, failed, total: items.length };
    });
  },
);

/**
 * Read-modify-write of one entry in the run's `items` array. Safe because the
 * batch is sequential — one worker, one item at a time, by design.
 */
async function patchItem(
  batchRunId: string,
  workspaceId: string,
  planItemId: string,
  changes: Partial<BatchRunItem>,
) {
  const supabase = createAdminClient();
  const { data: run } = await supabase
    .from("batch_runs")
    .select("items")
    .eq("id", batchRunId)
    .eq("workspace_id", workspaceId)
    .single();
  if (!run) return;

  const items = ((run.items ?? []) as BatchRunItem[]).map((i) =>
    i.planItemId === planItemId ? { ...i, ...changes } : i,
  );

  await supabase
    .from("batch_runs")
    .update({
      items,
      succeeded: items.filter((i) => i.status === "done").length,
      failed: items.filter((i) => i.status === "failed").length,
    })
    .eq("id", batchRunId)
    .eq("workspace_id", workspaceId);
}
