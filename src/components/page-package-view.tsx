"use client";

/**
 * The deliverable view of a page package (brief §6.7).
 *
 * Shared by the generate preview (read-only) and the document editor (editable),
 * so the operator sees the same thing before and after saving. Everything on
 * screen is copyable in the form a developer or client actually wants it: field
 * by field, as sectioned HTML, as JSON-LD, or as the whole package JSON.
 *
 * When `onChange` is passed the package becomes the editable source of truth for
 * the document — the markdown body is regenerated from it on save. That's the
 * whole reason editing lives here rather than in the prose editor: two editors
 * over one deliverable meant the exports silently drifted from the copy.
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, Copy, Download, Info, Link2, AlertTriangle, Plus, X } from "lucide-react";

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

/** `edit` undefined = read-only. `max` shows a length counter, for meta fields. */
function TextField({
  label,
  value,
  edit,
  max,
  mono,
  copyValue,
}: {
  label: string;
  value: string;
  edit?: (next: string) => void;
  max?: number;
  mono?: boolean;
  copyValue?: string;
}) {
  const length = value.trim().length;
  const over = max !== undefined && length > max;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1.5">
          {max !== undefined && (
            <span className={cn("text-xs tabular-nums", over ? "text-warning" : "text-muted-foreground")}>
              {length}/{max}
            </span>
          )}
          <CopyButton value={copyValue ?? value} label="" />
        </span>
      </div>
      {edit ? (
        <Input
          value={value}
          onChange={(e) => edit(e.target.value)}
          className={cn("text-sm", mono && "font-mono text-xs", over && "border-warning/50")}
        />
      ) : (
        <p className={cn("text-sm leading-snug", mono && "font-mono text-xs text-foreground/80", over && "text-warning")}>
          {value}
        </p>
      )}
    </div>
  );
}

function AreaField({
  label,
  value,
  edit,
  placeholder,
  muted,
}: {
  label?: string;
  value: string;
  edit?: (next: string) => void;
  placeholder?: string;
  muted?: boolean;
}) {
  if (!edit) {
    return (
      <div className={label ? "space-y-1" : undefined}>
        {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
        <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", muted && "text-muted-foreground")}>
          {value}
        </p>
      </div>
    );
  }
  return (
    <div className={label ? "space-y-1" : undefined}>
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      <Textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => edit(e.target.value)}
        className="min-h-0 text-sm"
      />
    </div>
  );
}

/** Wraps a list row so every list gets the same remove affordance. */
function Row({ onRemove, children }: { onRemove?: () => void; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Remove"
        >
          <X className="size-3" />
        </Button>
      )}
    </li>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="mt-2 h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <Plus className="size-3" />
      {label}
    </Button>
  );
}

type Props = {
  pkg: PagePackage;
  ctx: JsonLdContext;
  /** Filename stem for the JSON download. */
  slug?: string;
  /** Omit for a read-only view. When present, every field becomes editable. */
  onChange?: (next: PagePackage) => void;
};

export function PagePackageView({ pkg, ctx, slug, onChange }: Props) {
  const jsonLd = useMemo(() => buildJsonLd(pkg, ctx), [pkg, ctx]);
  const html = useMemo(() => packageToHtml(pkg, jsonLd), [pkg, jsonLd]);
  const jsonLdText = useMemo(
    () => JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd, null, 2),
    [jsonLd],
  );
  const omissions = useMemo(() => jsonLdOmissions(pkg), [pkg]);
  const url = pageUrl(pkg, ctx);

  /** Every edit funnels through here, so the parent always gets a whole package. */
  const patch = onChange ? (changes: Partial<PagePackage>) => onChange({ ...pkg, ...changes }) : undefined;
  /** `field(...)` returns undefined in read-only mode, which is what switches each control. */
  const field = <K extends keyof PagePackage>(key: K) =>
    patch ? (value: PagePackage[K]) => patch({ [key]: value } as Partial<PagePackage>) : undefined;

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

  const setSeoTitle = field("seoTitle");
  const setMeta = field("metaDescription");
  const setH1 = field("h1");
  const setUrl = field("suggestedUrl");
  const setHero = field("hero");
  const setServices = field("services");
  const setProcess = field("process");
  const setTrust = field("trustProof");
  const setFaq = field("faq");
  const setCta = field("cta");
  const setLinks = field("internalLinks");
  const setGaps = field("dataGaps");

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
              <li key={i} className="flex items-start gap-1.5">
                <span className="flex-1">· {gap}</span>
                {setGaps && (
                  <button
                    className="shrink-0 hover:underline"
                    onClick={() => setGaps(pkg.dataGaps.filter((_, j) => j !== i))}
                    title="Mark resolved"
                  >
                    resolved
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Panel title="Search metadata">
        <div className="space-y-3">
          <TextField label="SEO title" value={pkg.seoTitle} edit={setSeoTitle} max={60} />
          <TextField label="Meta description" value={pkg.metaDescription} edit={setMeta} max={160} />
          <TextField label="H1" value={pkg.h1} edit={setH1} />
          <TextField
            label="Suggested URL"
            value={setUrl ? pkg.suggestedUrl : url}
            edit={setUrl}
            mono
            copyValue={url}
          />
          {setUrl && <p className="font-mono text-xs text-muted-foreground">→ {url}</p>}
        </div>
      </Panel>

      <Panel title="Hero">
        <div className="space-y-2">
          <TextField
            label="Headline"
            value={pkg.hero.headline}
            edit={setHero && ((v) => setHero({ ...pkg.hero, headline: v }))}
          />
          <TextField
            label="Subheadline"
            value={pkg.hero.subheadline}
            edit={setHero && ((v) => setHero({ ...pkg.hero, subheadline: v }))}
          />
          <AreaField
            label="Body"
            value={pkg.hero.bodyMd}
            edit={setHero && ((v) => setHero({ ...pkg.hero, bodyMd: v }))}
          />
        </div>
      </Panel>

      <Panel title={pkg.services.heading || "Services"}>
        {setServices && (
          <div className="mb-2">
            <TextField
              label="Section heading"
              value={pkg.services.heading}
              edit={(v) => setServices({ ...pkg.services, heading: v })}
            />
          </div>
        )}
        {pkg.services.items.length === 0 && !setServices ? (
          <p className="text-xs text-muted-foreground">No services listed.</p>
        ) : (
          <ul className="space-y-2">
            {pkg.services.items.map((item, i) => (
              <Row
                key={i}
                onRemove={
                  setServices && (() => setServices({ ...pkg.services, items: pkg.services.items.filter((_, j) => j !== i) }))
                }
              >
                {setServices ? (
                  <div className="space-y-1.5">
                    <Input
                      value={item.name}
                      placeholder="Service name"
                      className="text-sm"
                      onChange={(e) =>
                        setServices({
                          ...pkg.services,
                          items: pkg.services.items.map((it, j) => (j === i ? { ...it, name: e.target.value } : it)),
                        })
                      }
                    />
                    <Textarea
                      value={item.description}
                      placeholder="What it covers"
                      className="min-h-0 text-sm"
                      onChange={(e) =>
                        setServices({
                          ...pkg.services,
                          items: pkg.services.items.map((it, j) =>
                            j === i ? { ...it, description: e.target.value } : it,
                          ),
                        })
                      }
                    />
                  </div>
                ) : (
                  <p className="text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground"> — {item.description}</span>
                  </p>
                )}
              </Row>
            ))}
          </ul>
        )}
        {setServices && (
          <AddButton
            label="Add service"
            onClick={() => setServices({ ...pkg.services, items: [...pkg.services.items, { name: "", description: "" }] })}
          />
        )}
      </Panel>

      <Panel title={pkg.process.heading || "Process"}>
        {setProcess && (
          <div className="mb-2">
            <TextField
              label="Section heading"
              value={pkg.process.heading}
              edit={(v) => setProcess({ ...pkg.process, heading: v })}
            />
          </div>
        )}
        {pkg.process.steps.length === 0 && !setProcess ? (
          <p className="text-xs text-muted-foreground">No process steps.</p>
        ) : (
          <ol className="space-y-2">
            {pkg.process.steps.map((step, i) => (
              <Row
                key={i}
                onRemove={
                  setProcess && (() => setProcess({ ...pkg.process, steps: pkg.process.steps.filter((_, j) => j !== i) }))
                }
              >
                {setProcess ? (
                  <div className="space-y-1.5">
                    <Input
                      value={step.title}
                      placeholder={`Step ${i + 1}`}
                      className="text-sm"
                      onChange={(e) =>
                        setProcess({
                          ...pkg.process,
                          steps: pkg.process.steps.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)),
                        })
                      }
                    />
                    <Textarea
                      value={step.description}
                      placeholder="What happens"
                      className="min-h-0 text-sm"
                      onChange={(e) =>
                        setProcess({
                          ...pkg.process,
                          steps: pkg.process.steps.map((s, j) => (j === i ? { ...s, description: e.target.value } : s)),
                        })
                      }
                    />
                  </div>
                ) : (
                  <p className="flex gap-2.5 text-sm">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-medium">{step.title}</span>
                      <span className="text-muted-foreground"> — {step.description}</span>
                    </span>
                  </p>
                )}
              </Row>
            ))}
          </ol>
        )}
        {setProcess && (
          <AddButton
            label="Add step"
            onClick={() => setProcess({ ...pkg.process, steps: [...pkg.process.steps, { title: "", description: "" }] })}
          />
        )}
      </Panel>

      <Panel title={pkg.trustProof.heading || "Trust & proof"}>
        {setTrust && (
          <div className="mb-2">
            <TextField
              label="Section heading"
              value={pkg.trustProof.heading}
              edit={(v) => setTrust({ ...pkg.trustProof, heading: v })}
            />
          </div>
        )}
        <AreaField
          value={pkg.trustProof.bodyMd}
          edit={setTrust && ((v) => setTrust({ ...pkg.trustProof, bodyMd: v }))}
        />
        {pkg.trustProof.points.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {pkg.trustProof.points.map((point, i) => (
              <Row
                key={i}
                onRemove={
                  setTrust &&
                  (() => setTrust({ ...pkg.trustProof, points: pkg.trustProof.points.filter((_, j) => j !== i) }))
                }
              >
                {setTrust ? (
                  <Input
                    value={point}
                    placeholder="Proof point"
                    className="text-sm"
                    onChange={(e) =>
                      setTrust({
                        ...pkg.trustProof,
                        points: pkg.trustProof.points.map((p, j) => (j === i ? e.target.value : p)),
                      })
                    }
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">· {point}</p>
                )}
              </Row>
            ))}
          </ul>
        ) : (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            No proof points — nothing in this client&apos;s knowledge docs evidences one.
          </p>
        )}
        {setTrust && (
          <AddButton
            label="Add proof point"
            onClick={() => setTrust({ ...pkg.trustProof, points: [...pkg.trustProof.points, ""] })}
          />
        )}
      </Panel>

      <Panel title={`FAQ · ${pkg.faq.length}`}>
        {pkg.faq.length === 0 && !setFaq ? (
          <p className="text-xs text-muted-foreground">No questions.</p>
        ) : (
          <ul className="space-y-3">
            {pkg.faq.map((item, i) => (
              <Row key={i} onRemove={setFaq && (() => setFaq(pkg.faq.filter((_, j) => j !== i)))}>
                {setFaq ? (
                  <div className="space-y-1.5">
                    <Input
                      value={item.question}
                      placeholder="Question"
                      className="text-sm"
                      onChange={(e) =>
                        setFaq(pkg.faq.map((f, j) => (j === i ? { ...f, question: e.target.value } : f)))
                      }
                    />
                    <Textarea
                      value={item.answer}
                      placeholder="Answer"
                      className="min-h-0 text-sm"
                      onChange={(e) => setFaq(pkg.faq.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f)))}
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium">{item.question}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.answer}</p>
                  </div>
                )}
              </Row>
            ))}
          </ul>
        )}
        {setFaq && <AddButton label="Add question" onClick={() => setFaq([...pkg.faq, { question: "", answer: "" }])} />}
      </Panel>

      <Panel title="Call to action">
        <div className="space-y-2">
          <TextField
            label="Heading"
            value={pkg.cta.heading}
            edit={setCta && ((v) => setCta({ ...pkg.cta, heading: v }))}
          />
          <AreaField
            label="Body"
            value={pkg.cta.bodyMd}
            muted
            edit={setCta && ((v) => setCta({ ...pkg.cta, bodyMd: v }))}
          />
          {setCta ? (
            <TextField
              label="Button label"
              value={pkg.cta.buttonLabel}
              edit={(v) => setCta({ ...pkg.cta, buttonLabel: v })}
            />
          ) : (
            <span className="inline-flex rounded-md bg-brand-subtle px-2 py-1 text-xs font-medium text-brand">
              {pkg.cta.buttonLabel}
            </span>
          )}
        </div>
      </Panel>

      <Panel title="Internal links">
        {pkg.internalLinks.length === 0 && !setLinks ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            None suggested — no URLs for this client appeared in the evidence snapshots.
          </p>
        ) : (
          <ul className="space-y-2">
            {pkg.internalLinks.map((link, i) => (
              <Row key={i} onRemove={setLinks && (() => setLinks(pkg.internalLinks.filter((_, j) => j !== i)))}>
                {setLinks ? (
                  <div className="space-y-1.5">
                    <Input
                      value={link.anchor}
                      placeholder="Anchor text"
                      className="text-sm"
                      onChange={(e) =>
                        setLinks(pkg.internalLinks.map((l, j) => (j === i ? { ...l, anchor: e.target.value } : l)))
                      }
                    />
                    <Input
                      value={link.url}
                      placeholder="/path/to/page"
                      className="font-mono text-xs"
                      onChange={(e) =>
                        setLinks(pkg.internalLinks.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))
                      }
                    />
                    <Input
                      value={link.reason}
                      placeholder="Why link here"
                      className="text-sm"
                      onChange={(e) =>
                        setLinks(pkg.internalLinks.map((l, j) => (j === i ? { ...l, reason: e.target.value } : l)))
                      }
                    />
                  </div>
                ) : (
                  <div className="text-sm">
                    <span className="flex items-center gap-1.5">
                      <Link2 className="size-3 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{link.anchor}</span>
                    </span>
                    <span className="ml-4.5 block font-mono text-xs text-muted-foreground">{link.url}</span>
                    <span className="ml-4.5 block text-xs text-muted-foreground">{link.reason}</span>
                  </div>
                )}
              </Row>
            ))}
          </ul>
        )}
        {setLinks && (
          <AddButton
            label="Add link"
            onClick={() => setLinks([...pkg.internalLinks, { anchor: "", url: "", reason: "" }])}
          />
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
