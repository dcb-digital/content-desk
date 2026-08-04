"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
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
import { FileDropzone } from "./file-dropzone";
import { createClient } from "@/lib/supabase/client";
import {
  EVIDENCE_BUCKET,
  evidenceObjectPath,
  type EvidenceUpload,
} from "@/lib/evidence/storage";

const PROVIDERS = [
  { id: "gsc", label: "Google Search Console" },
  { id: "ahrefs", label: "Ahrefs" },
  { id: "semrush", label: "SEMrush" },
  { id: "ga4", label: "Google Analytics 4" },
  { id: "file", label: "Other / Manual" },
];

/** Removes objects we uploaded but couldn't use, so failures leave no orphans. */
async function cleanUp(
  supabase: ReturnType<typeof createClient>,
  uploaded: EvidenceUpload[],
) {
  if (!uploaded.length) return;
  await supabase.storage.from(EVIDENCE_BUCKET).remove(uploaded.map((u) => u.path));
}

export function AddSourceForm({
  clientId,
  workspaceId,
}: {
  clientId: string;
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [label, setLabel] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleFilesChange(next: File[]) {
    setFiles(next);
    // Seed the label from the first filename so a drop-and-save is one click
    if (!label && next.length) {
      setLabel(next[0].name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setLoading(true);

    const supabase = createClient();
    const uploaded: EvidenceUpload[] = [];

    try {
      // Upload straight to Storage — keeps large exports out of the action body
      for (const [i, file] of files.entries()) {
        setProgress(`Uploading ${i + 1} of ${files.length}…`);
        const path = evidenceObjectPath(workspaceId, clientId, file.name);
        const { error } = await supabase.storage
          .from(EVIDENCE_BUCKET)
          .upload(path, file, { contentType: file.type || "text/csv", upsert: false });
        if (error) {
          toast.error(`Couldn't upload ${file.name}: ${error.message}`);
          await cleanUp(supabase, uploaded);
          return;
        }
        uploaded.push({ path, name: file.name, size: file.size });
      }

      setProgress(files.length ? "Parsing…" : null);
      const fd = new FormData(formRef.current);
      fd.set("clientId", clientId);
      fd.set("uploads", JSON.stringify(uploaded));

      const result = await addEvidenceSource(fd);
      if (result?.error) {
        toast.error(result.error);
        return; // the action removes the objects it rejected
      }
      if (result?.warning) toast.warning(result.warning);
      toast.success(
        result?.rows
          ? `Source added — ${result.rows.toLocaleString()} rows parsed${
              result.format && result.format !== "unknown" ? ` (${result.format})` : ""
            }`
          : "Source added",
      );
      setOpen(false);
      formRef.current.reset();
      setFiles([]);
      setLabel("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
      await cleanUp(supabase, uploaded);
    } finally {
      setProgress(null);
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
            <Label>
              Evidence files{" "}
              <span className="text-muted-foreground font-normal">
                (GSC, Ahrefs, SEMrush or GA4 exports)
              </span>
            </Label>
            <FileDropzone files={files} onFilesChange={handleFilesChange} disabled={loading} />
            <p className="text-xs text-muted-foreground">
              Format is auto-detected from the column headers. Attach several files to combine
              them into one snapshot.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. GSC export Jul 2026"
              required
            />
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

          <details className="group">
            <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Or paste CSV data instead
            </summary>
            <Textarea
              id="csvText"
              name="csvText"
              rows={6}
              placeholder={"Query,Clicks,Impressions,CTR,Position\nbest plumber sydney,120,1800,6.67%,4.2\n…"}
              className="font-mono text-xs mt-2"
            />
          </details>

          <div className="space-y-2">
            <Label htmlFor="staffNotes">Notes</Label>
            <Textarea id="staffNotes" name="staffNotes" rows={2} placeholder="Any context about this data…" />
          </div>

          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="submit" disabled={loading}>
              {loading ? progress ?? "Saving…" : "Save source"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
