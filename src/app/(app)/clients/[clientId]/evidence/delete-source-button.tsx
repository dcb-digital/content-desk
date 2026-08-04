"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteEvidenceSource } from "./actions";

export function DeleteSourceButton({ sourceId, clientId }: { sourceId: string; clientId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:text-destructive shrink-0"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this evidence source and all its snapshots?")) return;
        startTransition(() => deleteEvidenceSource(sourceId, clientId));
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
