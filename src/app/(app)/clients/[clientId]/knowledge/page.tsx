import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Plus, Pin, FileText, AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DeleteDocButton, TogglePinButton } from "./components";

const TYPE_LABELS: Record<string, string> = {
  brand_voice: "Brand voice",
  services: "Services",
  offers: "Offers",
  locations: "Locations",
  icp: "ICP",
  proof_case_studies: "Proof",
  banned_claims: "Banned claims",
  competitors: "Competitors",
  product_facts: "Product facts",
  other: "Other",
};

const PINNED_TOKEN_WARN = 8000;

type Props = { params: Promise<{ clientId: string }> };

export default async function KnowledgePage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: docs } = await supabase
    .from("knowledge_docs")
    .select("id, title, type, pinned, token_estimate, updated_at, body_md")
    .eq("client_id", clientId)
    .order("pinned", { ascending: false })
    .order("type")
    .order("title");

  const allDocs = docs ?? [];
  const pinnedTokens = allDocs
    .filter((d) => d.pinned)
    .reduce((sum, d) => sum + (d.token_estimate ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Knowledge</h2>
          <p className="text-sm text-muted-foreground">
            {allDocs.length === 0
              ? "No docs yet — add the first one."
              : `${allDocs.length} doc${allDocs.length === 1 ? "" : "s"} · ${allDocs.filter((d) => d.pinned).length} pinned`}
          </p>
        </div>
        <Link
          href={`/clients/${clientId}/knowledge/new`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus className="size-4 mr-1.5" />
          New doc
        </Link>
      </div>

      {pinnedTokens > PINNED_TOKEN_WARN && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>
            Pinned docs total ~{pinnedTokens.toLocaleString()} tokens — exceeds
            the 8k soft limit. Consider un-pinning some docs.
          </span>
        </div>
      )}

      {allDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <FileText className="size-9 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No knowledge docs yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Add brand voice, services, banned claims, and more.
          </p>
          <Link
            href={`/clients/${clientId}/knowledge/new`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="size-4 mr-1.5" />
            New doc
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {allDocs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 group">
              <TogglePinButton
                clientId={clientId}
                docId={doc.id}
                pinned={doc.pinned}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/clients/${clientId}/knowledge/${doc.id}`}
                    className="font-medium text-sm hover:text-primary transition-colors"
                  >
                    {doc.title}
                  </Link>
                  <Badge variant="secondary" className="text-xs">
                    {TYPE_LABELS[doc.type] ?? doc.type}
                  </Badge>
                  {doc.pinned && (
                    <span className="text-xs text-primary font-medium">Pinned</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ~{doc.token_estimate?.toLocaleString() ?? 0} tokens ·{" "}
                  {new Date(doc.updated_at).toLocaleDateString("en-AU", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/clients/${clientId}/knowledge/${doc.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Edit
                </Link>
                <DeleteDocButton clientId={clientId} docId={doc.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
