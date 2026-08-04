import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const FILTER_TABS = [
  { key: "active", label: "Active" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "all", label: "All" },
];

type Props = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export default async function DocumentsPage({ params, searchParams }: Props) {
  const { clientId } = await params;
  const { filter = "active" } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("documents")
    .select("id, title, kind, status, created_at, updated_at")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });

  if (filter === "in_review") {
    query = query.eq("status", "in_review");
  } else if (filter === "approved") {
    query = query.eq("status", "approved");
  } else if (filter === "active") {
    query = query.not("status", "in", '("killed","exported")');
  }
  // "all" = no additional filter

  const { data: docs } = await query;
  const allDocs = docs ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            {allDocs.length === 0 ? "No documents." : `${allDocs.length} document${allDocs.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link href={`/clients/${clientId}/documents/generate`} className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="size-4 mr-1.5" />
          Generate draft
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?filter=${tab.key}`}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              filter === tab.key
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {allDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <FileText className="size-9 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No documents</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Generate your first draft from this client&apos;s knowledge and objectives.
          </p>
          <Link href={`/clients/${clientId}/documents/generate`} className={cn(buttonVariants({ size: "sm" }))}>
            <Plus className="size-4 mr-1.5" />
            Generate draft
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {allDocs.map((doc) => {
            return (
              <Link
                key={doc.id}
                href={`/clients/${clientId}/documents/${doc.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {doc.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {doc.kind} ·{" "}
                    {new Date(doc.updated_at).toLocaleDateString("en-AU", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <StatusBadge status={doc.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
