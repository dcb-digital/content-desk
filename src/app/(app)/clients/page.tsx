import Link from "next/link";
import { Plus, Globe, LayoutGrid, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function ClientsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("clients")
    .select("id, name, domain, industry, locale, created_at")
    .is("archived_at", null)
    .order("name");

  if (q?.trim()) {
    query = query.ilike("name", `%${q.trim()}%`);
  }

  const { data: clients } = await query;
  const clientList = clients ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clientList.length === 0 && !q
              ? "No clients yet — add your first one."
              : `${clientList.length} client${clientList.length === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}`}
          </p>
        </div>
        <Link href="/clients/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="size-4 mr-1.5" />
          New client
        </Link>
      </div>

      {/* Search */}
      <form method="GET" className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search clients…"
          className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </form>

      {clientList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <LayoutGrid className="size-10 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium">{q ? "No clients match your search" : "No clients yet"}</p>
          {!q && (
            <>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Create a client to start building content plans.
              </p>
              <Link href="/clients/new" className={cn(buttonVariants({ size: "sm" }))}>
                <Plus className="size-4 mr-1.5" />
                New client
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientList.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="group block rounded-lg border border-border bg-card p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-medium truncate group-hover:text-primary transition-colors">
                    {client.name}
                  </h2>
                  {client.domain && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <Globe className="size-3 shrink-0" />
                      {client.domain}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {client.locale}
                </Badge>
              </div>
              {client.industry && (
                <p className="text-xs text-muted-foreground mt-3">{client.industry}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
