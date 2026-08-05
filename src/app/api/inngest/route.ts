import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { batchDraft } from "@/inngest/functions/batch-draft";

/** Each invocation runs one step — for this app, one document generation. */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [batchDraft],
});
