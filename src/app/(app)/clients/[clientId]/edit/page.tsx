import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { updateClientAction } from "./actions";

const LOCALE_OPTIONS = [
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-NZ", label: "English (New Zealand)" },
];

type Props = { params: Promise<{ clientId: string }> };

export default async function EditClientPage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, domain, industry, locale, notes")
    .eq("id", clientId)
    .is("archived_at", null)
    .single();

  if (!client) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/clients/${clientId}`} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <h2 className="text-lg font-semibold">Edit client</h2>
      </div>

      <form action={updateClientAction} className="space-y-5">
        <input type="hidden" name="clientId" value={clientId} />

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="name">Client name</label>
          <input
            id="name" name="name" required defaultValue={client.name}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="domain">
            Domain <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            id="domain" name="domain" defaultValue={client.domain ?? ""}
            placeholder="example.com.au"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="industry">
            Industry <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            id="industry" name="industry" defaultValue={client.industry ?? ""}
            placeholder="e.g. Plumbing, Legal, Healthcare"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="locale">Default locale</label>
          <select
            id="locale" name="locale" defaultValue={client.locale}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {LOCALE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-background">{o.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="notes">Notes</label>
          <textarea
            id="notes" name="notes" rows={3} defaultValue={client.notes ?? ""}
            placeholder="Internal notes about this client…"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 text-sm font-medium"
          >
            Save changes
          </button>
          <Link
            href={`/clients/${clientId}`}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 text-sm font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
