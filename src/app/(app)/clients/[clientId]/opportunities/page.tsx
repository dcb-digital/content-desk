import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { AddOpportunityForm } from "./add-opportunity-form";
import { StatusButton, DeleteOpportunityButton, AddToPlanButton } from "./opportunity-actions";

const TYPE_LABELS: Record<string, string> = {
  striking_distance: "Striking distance",
  low_ctr: "Low CTR",
  declining_page: "Declining page",
  keyword_no_page: "No landing page",
  competitor_gap: "Competitor gap",
  cannibalization: "Cannibalization",
  manual: "Manual",
};

/**
 * Rows are already grouped under Open / Planned / Dismissed headings, so a status
 * badge per row would be redundant. Colour goes on the score instead — that's the
 * number the decision actually turns on.
 */
function scoreTone(score: number): string {
  if (score >= 70) return "text-brand";
  if (score >= 40) return "text-foreground";
  return "text-muted-foreground";
}

type Props = { params: Promise<{ clientId: string }> };

export default async function OpportunitiesPage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();

  const [{ data: opps }, { data: plans }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, type, status, score, title, rationale, suggested_type, created_at")
      .eq("client_id", clientId)
      .order("score", { ascending: false }),
    membership
      ? supabase
          .from("content_plans")
          .select("id, name")
          .eq("client_id", clientId)
          .eq("workspace_id", membership.workspace_id)
          .not("status", "eq", "archived")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const allOpps = opps ?? [];
  const planList = (plans ?? []) as { id: string; name: string }[];
  const open = allOpps.filter((o) => o.status === "open");
  const planned = allOpps.filter((o) => o.status === "planned");
  const dismissed = allOpps.filter((o) => o.status === "dismissed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Opportunities</h2>
          <p className="text-sm text-muted-foreground">
            {open.length} open · {planned.length} planned · {dismissed.length} dismissed
          </p>
        </div>
        <AddOpportunityForm clientId={clientId} />
      </div>

      {allOpps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <Lightbulb className="size-9 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No opportunities yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Add manually, or they'll be generated from evidence in a future update.
          </p>
          <AddOpportunityForm clientId={clientId} />
        </div>
      ) : (
        <OppSection title="Open" opps={open} clientId={clientId} plans={planList} />
      )}

      {planned.length > 0 && <OppSection title="Planned" opps={planned} clientId={clientId} plans={planList} />}
      {dismissed.length > 0 && <OppSection title="Dismissed" opps={dismissed} clientId={clientId} plans={planList} dim />}
    </div>
  );
}

type Opp = {
  id: string;
  type: string;
  status: string;
  score: number;
  title: string;
  rationale: string | null;
  suggested_type: string;
};

function OppSection({
  title,
  opps,
  clientId,
  plans,
  dim,
}: {
  title: string;
  opps: Opp[];
  clientId: string;
  plans: { id: string; name: string }[];
  dim?: boolean;
}) {
  if (!opps.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className={`divide-y divide-border rounded-lg border border-border ${dim ? "opacity-60" : ""}`}>
        {opps.map((opp) => (
          <div key={opp.id} className="flex items-start gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{opp.title}</p>
                {/* Type is a category, not a state — neutral chip, no semantic colour */}
                <span className="inline-flex h-5 items-center rounded-md border border-border bg-muted/40 px-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {TYPE_LABELS[opp.type] ?? opp.type}
                </span>
              </div>
              {opp.rationale && (
                <p className="text-xs text-muted-foreground mt-0.5">{opp.rationale}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className={`font-mono tabular-nums font-medium ${scoreTone(opp.score)}`}>
                  {opp.score}
                </span>{" "}
                · {opp.suggested_type}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {opp.status === "open" && (
                <AddToPlanButton id={opp.id} title={opp.title} clientId={clientId} plans={plans} />
              )}
              <StatusButton id={opp.id} currentStatus={opp.status} clientId={clientId} />
              <DeleteOpportunityButton id={opp.id} clientId={clientId} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
