"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { EVIDENCE_FILE_EXTENSIONS, isSupportedEvidenceFile } from "@/lib/evidence/parse";
import { MAX_EVIDENCE_FILE_BYTES } from "@/lib/evidence/storage";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
};

export function FileDropzone({ files, onFilesChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming?.length) return;
    const accepted: File[] = [];

    for (const file of Array.from(incoming)) {
      if (!isSupportedEvidenceFile(file.name)) {
        toast.error(
          `${file.name} isn't supported — export it as ${EVIDENCE_FILE_EXTENSIONS.join(", ")} first.`,
        );
        continue;
      }
      if (file.size > MAX_EVIDENCE_FILE_BYTES) {
        toast.error(
          `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_EVIDENCE_FILE_BYTES)} per file.`,
        );
        continue;
      }
      const isDuplicate =
        files.some((f) => f.name === file.name && f.size === file.size) ||
        accepted.some((f) => f.name === file.name && f.size === file.size);
      if (isDuplicate) continue;
      accepted.push(file);
    }

    if (accepted.length) onFilesChange([...files, ...accepted]);
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-7 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-foreground/40 hover:bg-muted/40"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload className="size-6 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium">
          {dragging ? "Drop to attach" : "Drag CSV exports here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          or click to browse · {EVIDENCE_FILE_EXTENSIONS.join(", ")} ·{" "}
          {formatBytes(MAX_EVIDENCE_FILE_BYTES)} max each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={`${EVIDENCE_FILE_EXTENSIONS.join(",")},text/csv,text/tab-separated-values,text/plain`}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-2 px-3 py-2">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <span className="text-xs flex-1 min-w-0 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                onClick={() => onFilesChange(files.filter((f) => f !== file))}
                className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
