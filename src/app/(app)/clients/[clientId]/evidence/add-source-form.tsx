"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { addEvidenceSource } from "./actions";

const PROVIDERS = [
  { id: "gsc", label: "Google Search Console" },
  { id: "ahrefs", label: "Ahrefs" },
  { id: "semrush", label: "SEMrush" },
  { id: "ga4", label: "Google Analytics 4" },
  { id: "file", label: "Other / Manual" },
];

export function AddSourceForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setLoading(true);
    const fd = new FormData(formRef.current);
    fd.set("clientId", clientId);
    try {
      await addEvidenceSource(fd);
      setOpen(false);
      formRef.current.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus className="size-4 mr-1.5" />Add source</Button>} />
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add evidence source</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" placeholder="e.g. GSC export Jul 2026" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <select
              id="provider"
              name="provider"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id} className="bg-background">{p.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Period start</Label>
              <Input id="periodStart" name="periodStart" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">Period end</Label>
              <Input id="periodEnd" name="periodEnd" type="date" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csvText">
              CSV data{" "}
              <span className="text-muted-foreground font-normal">(paste export here)</span>
            </Label>
            <Textarea
              id="csvText"
              name="csvText"
              rows={8}
              placeholder={"Query,Clicks,Impressions,CTR,Position\nbest plumber sydney,120,1800,6.67%,4.2\n…"}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Supports GSC, Ahrefs, and SEMrush CSV formats. Auto-detected from column headers.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staffNotes">Notes</Label>
            <Textarea id="staffNotes" name="staffNotes" rows={2} placeholder="Any context about this data…" />
          </div>

          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save source"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
