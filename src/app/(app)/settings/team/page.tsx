import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { InviteForm, RemoveMemberButton, RoleToggle } from "./team-actions-client";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myMembership } = await supabase
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .single();
  if (!myMembership) redirect("/login");

  const { data: members } = await supabase
    .from("memberships")
    .select("id, user_id, role, created_at, users(email, full_name)")
    .eq("workspace_id", myMembership.workspace_id)
    .order("created_at", { ascending: true });

  const isAdmin = myMembership.role === "admin";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Team</h2>
        <p className="text-sm text-muted-foreground">
          {(members ?? []).length} member{(members ?? []).length === 1 ? "" : "s"} in this workspace.
        </p>
      </div>

      <div className="rounded-lg border border-border divide-y divide-border">
        {(members ?? []).map((m) => {
          const u = (Array.isArray(m.users) ? m.users[0] : m.users) as {
            email: string;
            full_name: string | null;
          } | null;
          const name = u?.full_name ?? u?.email ?? "Unknown";
          const isSelf = m.user_id === user.id;

          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Users className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {name}
                  {isSelf && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">{u?.email}</p>
              </div>
              <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-xs shrink-0">
                {m.role}
              </Badge>
              {isAdmin && !isSelf && (
                <div className="flex items-center gap-3 shrink-0">
                  <RoleToggle userId={m.user_id} currentRole={m.role as "admin" | "member"} />
                  <RemoveMemberButton userId={m.user_id} name={name} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && <InviteForm />}

      {!isAdmin && (
        <p className="text-sm text-muted-foreground">
          Only admins can invite or remove members.
        </p>
      )}
    </div>
  );
}
