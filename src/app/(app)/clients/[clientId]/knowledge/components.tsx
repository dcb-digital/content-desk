"use client";

import { useState, useTransition } from "react";
import { Pin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { togglePin, deleteKnowledgeDoc } from "./actions";
import { toast } from "sonner";

export function TogglePinButton({
  clientId,
  docId,
  pinned,
}: {
  clientId: string;
  docId: string;
  pinned: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(pinned);

  function handleClick() {
    setOptimistic(!optimistic);
    startTransition(async () => {
      await togglePin(clientId, docId, !optimistic);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={optimistic ? "Unpin" : "Pin to every generation"}
      className={cn(
        "p-1 rounded transition-colors",
        optimistic
          ? "text-primary hover:text-primary/70"
          : "text-muted-foreground/30 hover:text-muted-foreground",
      )}
    >
      <Pin className="size-3.5" fill={optimistic ? "currentColor" : "none"} />
    </button>
  );
}

export function DeleteDocButton({
  clientId,
  docId,
}: {
  clientId: string;
  docId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this knowledge doc? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteKnowledgeDoc(clientId, docId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
