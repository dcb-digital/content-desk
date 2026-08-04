import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Globe, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = { params: Promise<{ clientId: string }> };

export default async function ClientOverviewPage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .is("archived_at", null)
    .single();

  if (!client) notFound();

  // Fetch all counts in parallel
  const [
    { count: knowledgeCount },
    { count: openOppCount },
    { count: activePlanCount },
    { count: reviewCount },
  ] = await Promise.all([
    supabase.from("knowledge_docs").select("*", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "open"),
    supabase.from("content_plans").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "approved"),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "in_review"),
  ]);

  const stats = [
    { label: "Knowledge docs", value: knowledgeCount ?? 0, href: `knowledge` },
    { label: "Open opportunities", value: openOppCount ?? 0, href: `opportunities` },
    { label: "Approved plans", value: activePlanCount ?? 0, href: `plans` },
    { label: "Awaiting review", value: reviewCount ?? 0, href: `documents` },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {client.domain && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Globe className="size-3.5" />
                {client.domain}
              </span>
            )}
            <Badge variant="secondary" className="text-xs">
              {client.locale}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={`/clients/${clientId}/${stat.href}`}
            className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
          >
            <p className="text-2xl font-semibold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </Link>
        ))}
      </div>

      {client.notes && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="size-3.5" />
        Client added{" "}
        {new Date(client.created_at).toLocaleDateString("en-AU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
}
