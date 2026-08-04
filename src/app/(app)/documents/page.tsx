import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  planned: { label: "Planned", variant: "outline" },
  drafting: { label: "Drafting", variant: "secondary" },
  in_review: { label: "In review", variant: "default" },
  qa_flagged: { label: "QA flagged", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  exported: { label: "Exported", variant: "outline" },
  killed: { label: "Killed", variant: "outline" },
};

const FILTER_TABS = [
  { key: "active", label: "Active" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "all", label: "All" },
];

type Props = { searchParams: Promise<{ filter?: string }> };

export default async function AllDocumentsPage({ searchParams }: Props) {
  const { filter = "active" } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) redirect("/login");

  let query = supabase
    .from("documents")
    .select("id, title, kind, status, updated_at, client_id, clients(name)")
    .eq("workspace_id", membership.workspace_id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filter === "in_review") query = query.eq("status", "in_review");
  else if (filter === "approved") query = query.eq("status", "approved");
  else if (filter === "active") query = query.not("status", "in", '("killed","exported")');

  const { data: docs } = await query;
  const allDocs = docs ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">All documents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {allDocs.length} document{allDocs.length === 1 ? "" : "s"} across all clients
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?filter=${tab.key}`}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              filter === tab.key
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {allDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <FileText className="size-9 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No documents</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {allDocs.map((doc) => {
            const status = STATUS_LABELS[doc.status] ?? { label: doc.status, variant: "outline" as const };
            const client = Array.isArray(doc.clients) ? doc.clients[0] : doc.clients as { name: string } | null;
            return (
              <Link
                key={doc.id}
                href={`/clients/${doc.client_id}/documents/${doc.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {doc.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {client?.name ?? "Unknown client"} ·{" "}
                    {new Date(doc.updated_at).toLocaleDateString("en-AU", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
