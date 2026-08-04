"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deletePlanItem } from "../actions";

export function DeleteItemButton({
  itemId,
  planId,
  clientId,
}: {
  itemId: string;
  planId: string;
  clientId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:text-destructive shrink-0"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this item from the plan?")) return;
        startTransition(() => deletePlanItem(itemId, planId, clientId));
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
