import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ clientId: string }> };

export default async function PlansPage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plans } = await supabase
    .from("content_plans")
    .select("id, name, status, horizon_days, start_date, focus_mode, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  // Item counts per plan
  const planIds = (plans ?? []).map((p) => p.id);
  const { data: itemCounts } = planIds.length
    ? await supabase
        .from("plan_items")
        .select("plan_id")
        .in("plan_id", planIds)
    : { data: [] };

  const countMap = new Map<string, number>();
  for (const r of itemCounts ?? []) {
    countMap.set(r.plan_id, (countMap.get(r.plan_id) ?? 0) + 1);
  }

  const allPlans = plans ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Content plans</h2>
          <p className="text-sm text-muted-foreground">
            {allPlans.length === 0 ? "No plans yet." : `${allPlans.length} plan${allPlans.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href={`/clients/${clientId}/plans/new`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus className="size-4 mr-1.5" />
          New plan
        </Link>
      </div>

      {allPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <CalendarDays className="size-9 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No content plans</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Create a plan to schedule posts, pages, and refreshes for this client.
          </p>
          <Link
            href={`/clients/${clientId}/plans/new`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="size-4 mr-1.5" />
            New plan
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {allPlans.map((plan) => {
            return (
              <Link
                key={plan.id}
                href={`/clients/${clientId}/plans/${plan.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">
                    {plan.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {plan.horizon_days}d horizon · starts{" "}
                    {new Date(plan.start_date).toLocaleDateString("en-AU", {
                      day: "numeric", month: "short", year: "numeric",
                    })} · {countMap.get(plan.id) ?? 0} items
                  </p>
                </div>
                <StatusBadge status={plan.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
