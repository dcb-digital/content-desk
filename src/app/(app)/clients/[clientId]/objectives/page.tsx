import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ObjectivesForm } from "./objectives-form";

type Props = { params: Promise<{ clientId: string }> };

export default async function ObjectivesPage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: current } = await supabase
    .from("objectives")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_current", true)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Objectives</h2>
        <p className="text-sm text-muted-foreground">
          {current
            ? "Update the client's objectives. Saving creates a new version — existing plans keep their snapshot."
            : "Set this client's objectives. Plans and drafts are grounded in these."}
        </p>
      </div>
      <ObjectivesForm clientId={clientId} current={current} />
    </div>
  );
}
