import Link from "next/link";
import { Plus, Globe, LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";

type Client = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  locale: string;
  created_at: string;
};

export default async function ClientsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, domain, industry, locale, created_at")
    .is("archived_at", null)
    .order("name");

  if (error) {
    console.error("Failed to fetch clients:", error);
  }

  const clientList: Client[] = clients ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clientList.length === 0
              ? "No clients yet — add your first one."
              : `${clientList.length} client${clientList.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/clients/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus className="size-4 mr-1.5" />
          New client
        </Link>
      </div>

      {clientList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <LayoutGrid className="size-10 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium">No clients yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Create a client to start building content plans.
          </p>
          <Link
            href="/clients/new"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="size-4 mr-1.5" />
            New client
          </Link>
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
                <p className="text-xs text-muted-foreground mt-3">
                  {client.industry}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
