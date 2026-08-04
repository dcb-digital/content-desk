import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PromptEditor } from "./prompt-editor";

export default async function PromptsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships").select("workspace_id").eq("user_id", user.id).single();
  if (!membership) redirect("/login");

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, key, version, body, notes, is_active")
    .eq("workspace_id", membership.workspace_id)
    .eq("is_active", true)
    .order("key");

  const allPrompts = prompts ?? [];

  const system = allPrompts.filter((p) => p.key === "system_rules");
  const tasks = allPrompts.filter((p) => p.key.startsWith("task_"));
  const other = allPrompts.filter((p) => p.key !== "system_rules" && !p.key.startsWith("task_"));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Prompt library</h2>
        <p className="text-sm text-muted-foreground">
          All prompts are stored in the database. Editing here takes effect immediately — no deploy needed.
          Each save increments the version tracked in generation logs.
        </p>
      </div>

      {system.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System</h3>
          {system.map((p) => <PromptEditor key={p.id} prompt={p} />)}
        </section>
      )}

      {tasks.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasks</h3>
          {tasks.map((p) => <PromptEditor key={p.id} prompt={p} />)}
        </section>
      )}

      {other.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other</h3>
          {other.map((p) => <PromptEditor key={p.id} prompt={p} />)}
        </section>
      )}

      {allPrompts.length === 0 && (
        <p className="text-sm text-muted-foreground">No prompts found for this workspace.</p>
      )}
    </div>
  );
}
