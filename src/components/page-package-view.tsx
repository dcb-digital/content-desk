"use client";

/**
 * The deliverable view of a page package (brief §6.7).
 *
 * Shared by the generate preview and the document editor's Package tab so the
 * operator sees the same thing before and after saving. Everything on screen is
 * copyable in the form a developer or client actually wants it: field by field,
 * as sectioned HTML, as JSON-LD, or as the whole package JSON.
 */

import { useMemo, useState } from "react";
import {
  buildJsonLd,
  jsonLdOmissions,
  packageToHtml,
  pageUrl,
  normaliseUrlPath,
  type JsonLdContext,
  type PagePackage,
} from "@/lib/ai/page-package";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Copy, Download, Info, Link2, AlertTriangle } from "lucide-react";

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
      {label}
    </Button>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/** Meta fields live and die by length, so the count is part of the field, not a footnote. */
function MetaField({ label, value, max }: { label: string; value: string; max: number }) {
  const length = value.trim().length;
  const over = length > max;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className={cn("text-xs tabular-nums", over ? "text-warning" : "text-muted-foreground")}>
            {length}/{max}
          </span>
          <CopyButton value={value} label="" />
        </span>
      </div>
      <p className={cn("text-sm leading-snug", over && "text-warning")}>{value}</p>
    </div>
  );
}

type Props = {
  pkg: PagePackage;
  ctx: JsonLdContext;
  /** Filename stem for the JSON download. */
  slug?: string;
};

export function PagePackageView({ pkg, ctx, slug }: Props) {
  const jsonLd = useMemo(() => buildJsonLd(pkg, ctx), [pkg, ctx]);
  const html = useMemo(() => packageToHtml(pkg, jsonLd), [pkg, jsonLd]);
  const jsonLdText = useMemo(
    () => JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd, null, 2),
    [jsonLd],
  );
  const omissions = useMemo(() => jsonLdOmissions(pkg), [pkg]);
  const url = pageUrl(pkg, ctx);

  function downloadJson() {
    const stem = (slug ?? normaliseUrlPath(pkg.suggestedUrl).split("/").filter(Boolean).pop()) || "page-package";
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${stem}.package.json`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <CopyButton value={html} label="Copy HTML" />
        <CopyButton value={JSON.stringify(pkg, null, 2)} label="Copy JSON" />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={downloadJson}
        >
          <Download className="size-3" />
          Download package
        </Button>
      </div>

      {pkg.dataGaps.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <AlertTriangle className="size-3.5" />
            Data gaps — resolve before this ships
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-warning">
            {pkg.dataGaps.map((gap, i) => (
              <li key={i}>· {gap}</li>
            ))}
          </ul>
        </div>
      )}

      <Panel title="Search metadata">
        <div className="space-y-3">
          <MetaField label="SEO title" value={pkg.seoTitle} max={60} />
          <MetaField label="Meta description" value={pkg.metaDescription} max={160} />
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">H1</span>
              <CopyButton value={pkg.h1} label="" />
            </div>
            <p className="text-sm leading-snug">{pkg.h1}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Suggested URL</span>
              <CopyButton value={url} label="" />
            </div>
            <p className="font-mono text-xs text-foreground/80">{url}</p>
          </div>
        </div>
      </Panel>

      <Panel title="Hero">
        <p className="text-sm font-medium">{pkg.hero.headline}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{pkg.hero.subheadline}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{pkg.hero.bodyMd}</p>
      </Panel>

      <Panel title={pkg.services.heading || "Services"}>
        {pkg.services.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No services listed.</p>
        ) : (
          <ul className="space-y-2">
            {pkg.services.items.map((item, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground"> — {item.description}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={pkg.process.heading || "Process"}>
        {pkg.process.steps.length === 0 ? (
          <p className="text-xs text-muted-foreground">No process steps.</p>
        ) : (
          <ol className="space-y-2">
            {pkg.process.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium">{step.title}</span>
                  <span className="text-muted-foreground"> — {step.description}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel title={pkg.trustProof.heading || "Trust & proof"}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{pkg.trustProof.bodyMd}</p>
        {pkg.trustProof.points.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {pkg.trustProof.points.map((point, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                · {point}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            No proof points — nothing in this client&apos;s knowledge docs evidences one.
          </p>
        )}
      </Panel>

      <Panel title={`FAQ · ${pkg.faq.length}`}>
        {pkg.faq.length === 0 ? (
          <p className="text-xs text-muted-foreground">No questions.</p>
        ) : (
          <div className="space-y-3">
            {pkg.faq.map((item, i) => (
              <div key={i}>
                <p className="text-sm font-medium">{item.question}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Call to action">
        <p className="text-sm font-medium">{pkg.cta.heading}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{pkg.cta.bodyMd}</p>
        <span className="mt-2 inline-flex rounded-md bg-brand-subtle px-2 py-1 text-xs font-medium text-brand">
          {pkg.cta.buttonLabel}
        </span>
      </Panel>

      <Panel title="Internal links">
        {pkg.internalLinks.length === 0 ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            None suggested — no URLs for this client appeared in the evidence snapshots.
          </p>
        ) : (
          <ul className="space-y-2">
            {pkg.internalLinks.map((link, i) => (
              <li key={i} className="text-sm">
                <span className="flex items-center gap-1.5">
                  <Link2 className="size-3 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{link.anchor}</span>
                </span>
                <span className="ml-4.5 block font-mono text-xs text-muted-foreground">{link.url}</span>
                <span className="ml-4.5 block text-xs text-muted-foreground">{link.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={`JSON-LD · ${jsonLd.map((n) => n["@type"] as string).join(" + ")}`}
        action={<CopyButton value={jsonLdText} label="Copy" />}
      >
        <pre className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
          {jsonLdText}
        </pre>
        {omissions.length > 0 && (
          <ul className="mt-2 space-y-1">
            {omissions.map((note, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3 shrink-0" />
                Not emitted: {note}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
