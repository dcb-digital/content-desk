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
import { addOpportunity } from "./actions";

const OPP_TYPES = [
  { id: "striking_distance", label: "Striking distance" },
  { id: "low_ctr", label: "Low CTR" },
  { id: "declining_page", label: "Declining page" },
  { id: "keyword_no_page", label: "Keyword with no page" },
  { id: "competitor_gap", label: "Competitor gap" },
  { id: "cannibalization", label: "Cannibalization" },
  { id: "manual", label: "Manual / Other" },
];

const CONTENT_TYPES = [
  { id: "post", label: "Blog post" },
  { id: "page", label: "Service / location page" },
  { id: "refresh", label: "Refresh existing page" },
];

export function AddOpportunityForm({ clientId }: { clientId: string }) {
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
      await addOpportunity(fd);
      setOpen(false);
      formRef.current.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus className="size-4 mr-1.5" />Add opportunity</Button>} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add opportunity</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title / keyword</Label>
            <Input id="title" name="title" placeholder="e.g. 'emergency plumber sydney' — no landing page" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {OPP_TYPES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-background">{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="suggested_type">Content type</Label>
              <select
                id="suggested_type"
                name="suggested_type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-background">{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="score">
              Priority score{" "}
              <span className="text-muted-foreground font-normal">(0–100)</span>
            </Label>
            <Input id="score" name="score" type="number" min="0" max="100" defaultValue="50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rationale">Rationale</Label>
            <Textarea id="rationale" name="rationale" rows={2}
              placeholder="One-line explanation of why this is an opportunity…" />
          </div>

          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
