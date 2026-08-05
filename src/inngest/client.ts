/**
 * Inngest client. `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` are read from the
 * environment; with neither set the SDK runs in dev mode and talks to the local
 * Inngest Dev Server (`npx inngest-cli@latest dev`).
 */
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "content-desk" });

/** Trigger for a "draft all items" run. The row named by `batchRunId` holds the state. */
export const BATCH_DRAFT_EVENT = "content-desk/plan.batch-draft";

export type BatchDraftEventData = {
  batchRunId: string;
  workspaceId: string;
  clientId: string;
  planId: string;
  userId: string | null;
};
