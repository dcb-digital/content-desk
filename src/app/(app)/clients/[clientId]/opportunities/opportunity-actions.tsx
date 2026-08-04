"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setOpportunityStatus, deleteOpportunity } from "./actions";

export function StatusButton({
  id,
  currentStatus,
  clientId,
}: {
  id: string;
  currentStatus: string;
  clientId: string;
}) {
  const [pending, startTransition] = useTransition();

  const next =
    currentStatus === "open" ? "planned" :
    currentStatus === "planned" ? "dismissed" : "open";

  const labels: Record<string, string> = {
    open: "Mark planned",
    planned: "Dismiss",
    dismissed: "Re-open",
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => setOpportunityStatus(id, next, clientId))}
    >
      {labels[currentStatus]}
    </Button>
  );
}

export function DeleteOpportunityButton({ id, clientId }: { id: string; clientId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this opportunity?")) return;
        startTransition(() => deleteOpportunity(id, clientId));
      }}
    >
      Delete
    </Button>
  );
}
