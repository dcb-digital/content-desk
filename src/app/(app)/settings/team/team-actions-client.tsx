"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { removeMember, updateMemberRole } from "./actions";
import { toast } from "sonner";

export function RemoveMemberButton({ userId, name }: { userId: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Remove ${name} from the workspace?`)) return;
        startTransition(async () => {
          const result = await removeMember(userId);
          if (result?.error) toast.error(result.error);
        });
      }}
    >
      Remove
    </Button>
  );
}

export function RoleToggle({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: "admin" | "member";
}) {
  const [pending, startTransition] = useTransition();
  const next = currentRole === "admin" ? "member" : "admin";

  return (
    <button
      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await updateMemberRole(userId, next);
          if (result?.error) toast.error(result.error);
        })
      }
    >
      {pending ? "…" : `Make ${next}`}
    </button>
  );
}

export function InviteForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { inviteMember } = await import("./actions");
    const result = await inviteMember(fd);
    setLoading(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Invite sent");
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-5 space-y-4">
      <p className="text-sm font-medium">Invite a team member</p>
      <div className="flex gap-3">
        <input
          name="email"
          type="email"
          placeholder="colleague@agency.com"
          required
          className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select
          name="role"
          defaultValue="member"
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="member" className="bg-background">Member</option>
          <option value="admin" className="bg-background">Admin</option>
        </select>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Inviting…" : "Invite"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        An invite email will be sent. If they already have an account they'll be added directly.
      </p>
    </form>
  );
}
