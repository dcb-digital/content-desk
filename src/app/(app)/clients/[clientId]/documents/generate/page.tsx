import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GenerateForm } from "./generate-form";

type Props = { params: Promise<{ clientId: string }> };

export default async function GenerateDraftPage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check provider is configured
  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();

  const { data: settings } = membership
    ? await supabase
        .from("workspace_settings")
        .select("default_provider, providers")
        .eq("workspace_id", membership.workspace_id)
        .single()
    : { data: null };

  const hasProvider =
    settings?.providers && Object.keys(settings.providers).length > 0;

  // Check objectives + knowledge are set
  const { data: objective } = await supabase
    .from("objectives")
    .select("summary_md")
    .eq("client_id", clientId)
    .eq("is_current", true)
    .maybeSingle();

  const { data: pinnedDocs } = await supabase
    .from("knowledge_docs")
    .select("id")
    .eq("client_id", clientId)
    .eq("pinned", true);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Generate draft</h2>
        <p className="text-sm text-muted-foreground">
          Grounded in this client&apos;s pinned knowledge and current objectives.
        </p>
      </div>

      {!hasProvider && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
          No LLM provider configured.{" "}
          <a href="/settings" className="underline">Add one in Settings →</a>
        </div>
      )}

      {!objective && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          No objectives set — generation will proceed without them.{" "}
          <a href={`/clients/${clientId}/objectives`} className="underline">Add objectives →</a>
        </div>
      )}

      {(!pinnedDocs || pinnedDocs.length === 0) && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          No pinned knowledge docs — the draft won&apos;t have brand context.{" "}
          <a href={`/clients/${clientId}/knowledge`} className="underline">Pin docs →</a>
        </div>
      )}

      <GenerateForm clientId={clientId} disabled={!hasProvider} />
    </div>
  );
}
