"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { setOpportunityStatus, deleteOpportunity, addOppToPlan } from "./actions";

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

export function AddToPlanButton({
  id,
  title,
  clientId,
  plans,
}: {
  id: string;
  title: string;
  clientId: string;
  plans: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(plans[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  async function handleAdd() {
    if (!selectedPlan) return;
    setLoading(true);
    try {
      await addOppToPlan({ opportunityId: id, planId: selectedPlan, clientId, workingTitle: title, scheduledDate: date });
      setOpen(false);
      router.push(`/clients/${clientId}/plans/${selectedPlan}`);
    } finally {
      setLoading(false);
    }
  }

  if (!plans.length) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Add to plan</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to content plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground truncate">{title}</p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Plan</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id} className="bg-background">{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Scheduled date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button onClick={handleAdd} disabled={loading || !selectedPlan}>
              {loading ? "Adding…" : "Add to plan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
