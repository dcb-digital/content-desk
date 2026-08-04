"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { addPlanItem } from "../actions";

export function AddItemForm({ planId, clientId }: { planId: string; clientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setLoading(true);
    const fd = new FormData(formRef.current);
    fd.set("planId", planId);
    fd.set("clientId", clientId);
    try {
      await addPlanItem(fd);
      setOpen(false);
      formRef.current.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus className="size-4 mr-1.5" />Add item</Button>} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add plan item</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="workingTitle">Working title</Label>
            <Input id="workingTitle" name="workingTitle" placeholder="e.g. Best Plumbers in Melbourne" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Scheduled date</Label>
              <Input id="scheduledDate" name="scheduledDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type" name="type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="post" className="bg-background">Blog post</option>
                <option value="page" className="bg-background">Service / location page</option>
                <option value="refresh" className="bg-background">Refresh</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetKeyword">
              Target keyword{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="targetKeyword" name="targetKeyword" placeholder="e.g. emergency plumber melbourne" />
          </div>

          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
