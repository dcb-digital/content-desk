import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientNav } from "@/components/client-nav";

type Props = {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
};

export default async function ClientLayout({ children, params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, domain")
    .eq("id", clientId)
    .is("archived_at", null)
    .single();

  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6 -mt-6 -mx-6 min-h-full">
      <div className="px-6 pt-6 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
            Client
          </p>
          <h1 className="text-xl font-semibold">{client.name}</h1>
          {client.domain && (
            <p className="text-sm text-muted-foreground">{client.domain}</p>
          )}
        </div>
        <ClientNav clientId={clientId} />
      </div>
      <div className="px-6 pb-6 flex-1">{children}</div>
    </div>
  );
}
