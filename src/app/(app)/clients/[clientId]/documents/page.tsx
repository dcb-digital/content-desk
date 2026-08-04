import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  drafting: { label: "Drafting", variant: "secondary" },
  in_review: { label: "In review", variant: "default" },
  approved: { label: "Approved", variant: "default" },
  exported: { label: "Exported", variant: "outline" },
  killed: { label: "Killed", variant: "outline" },
};

type Props = { params: Promise<{ clientId: string }> };

export default async function DocumentsPage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, kind, status, created_at, updated_at")
    .eq("client_id", clientId)
    .neq("status", "killed")
    .order("updated_at", { ascending: false });

  const allDocs = docs ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            {allDocs.length === 0
              ? "No documents yet."
              : `${allDocs.length} document${allDocs.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href={`/clients/${clientId}/documents/generate`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus className="size-4 mr-1.5" />
          Generate draft
        </Link>
      </div>

      {allDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <FileText className="size-9 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No documents yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Generate your first draft from this client&apos;s knowledge and objectives.
          </p>
          <Link
            href={`/clients/${clientId}/documents/generate`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="size-4 mr-1.5" />
            Generate draft
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {allDocs.map((doc) => {
            const status = STATUS_LABELS[doc.status] ?? { label: doc.status, variant: "outline" as const };
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
                      day: "numeric",
                      month: "short",
                      year: "numeric",
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
