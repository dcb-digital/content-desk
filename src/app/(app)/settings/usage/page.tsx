import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function UsagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) redirect("/login");

  const { data: logs } = await supabase
    .from("generation_logs")
    .select("id, action, provider, model, input_tokens, output_tokens, est_cost_usd, duration_ms, success, created_at, clients(name)")
    .eq("workspace_id", membership.workspace_id)
    .order("created_at", { ascending: false })
    .limit(100);

  const allLogs = logs ?? [];

  // Aggregate totals
  const totalCost = allLogs.reduce((s, l) => s + (l.est_cost_usd ?? 0), 0);
  const totalTokensIn = allLogs.reduce((s, l) => s + (l.input_tokens ?? 0), 0);
  const totalTokensOut = allLogs.reduce((s, l) => s + (l.output_tokens ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Usage & costs</h2>
        <p className="text-sm text-muted-foreground">
          Last 100 generations. Costs are estimates based on provider list prices.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-semibold">{allLogs.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Generations</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-semibold">
            ${totalCost.toFixed(4)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Est. cost (USD)</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-semibold">
            {((totalTokensIn + totalTokensOut) / 1000).toFixed(1)}k
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Total tokens</p>
        </div>
      </div>

      {allLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No generations yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Action</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Model</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Tokens in</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Tokens out</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allLogs.map((log) => {
                const clientRaw = log.clients as unknown;
                const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as { name: string } | null;
                return (
                  <tr key={log.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString("en-AU", {
                        day: "numeric", month: "short",
                      })}{" "}
                      {new Date(log.created_at).toLocaleTimeString("en-AU", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-xs truncate max-w-[120px]">
                      {client?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.success ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-muted-foreground truncate max-w-[140px]">
                      {log.model}
                    </td>
                    <td className="px-4 py-2 text-xs text-right text-muted-foreground">
                      {log.input_tokens?.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-right text-muted-foreground">
                      {log.output_tokens?.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-right font-mono">
                      ${(log.est_cost_usd ?? 0).toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
