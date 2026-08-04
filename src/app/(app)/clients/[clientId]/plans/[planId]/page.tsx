import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AddItemForm } from "./add-item-form";
import { DeleteItemButton } from "./delete-item-button";

const ITEM_TYPE_LABELS: Record<string, string> = {
  post: "Blog post",
  page: "Service/location page",
  refresh: "Refresh",
};

const STATUS: Record<string, "default" | "secondary" | "outline"> = {
  planned: "secondary",
  briefed: "secondary",
  brief_approved: "secondary",
  drafting: "default",
  in_review: "default",
  approved: "default",
  exported: "outline",
};

type Props = { params: Promise<{ clientId: string; planId: string }> };

export default async function PlanDetailPage({ params }: Props) {
  const { clientId, planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plan } = await supabase
    .from("content_plans")
    .select("id, name, status, horizon_days, start_date, focus_mode, frequency")
    .eq("id", planId)
    .eq("client_id", clientId)
    .single();

  if (!plan) notFound();

  const { data: items } = await supabase
    .from("plan_items")
    .select("id, type, scheduled_date, working_title, target_keyword, status")
    .eq("plan_id", planId)
    .order("scheduled_date", { ascending: true });

  const allItems = items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{plan.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {plan.horizon_days}d horizon · starts{" "}
            {new Date(plan.start_date).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric",
            })} · {plan.focus_mode.replace(/_/g, " ")}
          </p>
        </div>
        <AddItemForm planId={planId} clientId={clientId} />
      </div>

      {allItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-14 text-center">
          <p className="text-sm text-muted-foreground">No items yet. Add the first one.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {allItems.map((item) => {
            const statusVariant = STATUS[item.status] ?? "outline";
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-20 shrink-0 text-xs text-muted-foreground">
                  {new Date(item.scheduled_date).toLocaleDateString("en-AU", {
                    day: "numeric", month: "short",
                  })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.working_title}</p>
                  {item.target_keyword && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      🎯 {item.target_keyword}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {ITEM_TYPE_LABELS[item.type] ?? item.type}
                </Badge>
                <Badge variant={statusVariant} className="text-xs shrink-0">
                  {item.status.replace(/_/g, " ")}
                </Badge>
                <DeleteItemButton itemId={item.id} planId={planId} clientId={clientId} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
