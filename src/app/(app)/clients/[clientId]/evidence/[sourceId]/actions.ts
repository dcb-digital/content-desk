"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Query = { query: string; clicks: number; impressions: number; ctr: number; position: number };

export async function scanOpportunities(
  clientId: string,
  queries: Query[],
  snapshotId: string,
): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) throw new Error("No workspace");

  // Find existing open opportunity titles to avoid duplicates
  const { data: existing } = await supabase
    .from("opportunities")
    .select("title")
    .eq("client_id", clientId)
    .eq("status", "open");

  const existingTitles = new Set((existing ?? []).map((o) => o.title.toLowerCase()));

  // Score: higher impressions + closer to page 1 = higher score
  const newOpps = queries
    .filter((q) => !existingTitles.has(q.query.toLowerCase()))
    .map((q) => {
      // Score 0-100: blend position closeness to 1 and impression volume
      const posScore = Math.max(0, 100 - (q.position - 1) * 5); // pos 4 → 85, pos 20 → 5
      const impScore = Math.min(50, (q.impressions / 500) * 50);
      const score = Math.round((posScore + impScore) / 2);

      return {
        workspace_id: membership.workspace_id,
        client_id: clientId,
        type: "striking_distance" as const,
        status: "open" as const,
        title: q.query,
        rationale: `Position ${q.position.toFixed(1)}, ${q.impressions.toLocaleString()} impressions, ${(q.ctr * 100).toFixed(1)}% CTR`,
        suggested_type: "post" as const,
        score,
        payload: { clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position },
        evidence_refs: [{ snapshotId }],
      };
    });

  if (!newOpps.length) return 0;

  await supabase.from("opportunities").insert(newOpps);
  revalidatePath(`/clients/${clientId}/opportunities`);
  return newOpps.length;
}
