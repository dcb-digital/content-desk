/**
 * Page package (brief §6.7) — the structured output for service/location/money pages.
 *
 * A "page" is a copy package, never rendered HTML we host (iron rule #7). This module
 * owns the shape (Zod, so generation is validated not trusted), plus the three
 * renderings the agency actually hands over: markdown, sectioned HTML, and JSON-LD.
 *
 * JSON-LD is built here in code rather than asked for from the model — schema.org
 * validity is a mechanical property and a model that invents an `aggregateRating`
 * breaks iron rule #2. Fields we have no grounded value for are omitted, not guessed.
 */
import { z } from "zod";
import { marked } from "marked";

/* ----------------------------- Schema ----------------------------- */

/**
 * Every optional field is `.nullable()` rather than `.optional()` — OpenAI strict
 * structured outputs require all properties present, so "unknown" has to be an
 * explicit null the model chooses, which also makes data gaps visible in the UI.
 */
export const PagePackageSchema = z.object({
  seoTitle: z
    .string()
    .describe("SEO <title>. 50–60 characters, leads with the primary keyword, includes the brand only if it fits."),
  metaDescription: z
    .string()
    .describe("Meta description. 140–155 characters, states the offer and a reason to click. No quotes."),
  h1: z.string().describe("The on-page H1. Distinct from the SEO title, written for humans."),
  suggestedUrl: z
    .string()
    .describe("Root-relative URL path in lowercase kebab-case, e.g. /services/family-law-sydney"),
  serviceType: z
    .string()
    .nullable()
    .describe("The service this page sells, plainly named, e.g. 'Family law mediation'. Null for non-service pages."),

  hero: z.object({
    headline: z.string(),
    subheadline: z.string(),
    bodyMd: z.string().describe("1–2 short paragraphs of markdown. The keyword appears naturally here."),
  }),

  services: z.object({
    heading: z.string(),
    items: z
      .array(z.object({ name: z.string(), description: z.string() }))
      .describe("What's included. Only services evidenced in the knowledge docs."),
  }),

  process: z.object({
    heading: z.string(),
    steps: z.array(z.object({ title: z.string(), description: z.string() })),
  }),

  trustProof: z.object({
    heading: z.string(),
    bodyMd: z.string(),
    points: z
      .array(z.string())
      .describe("Proof points drawn ONLY from proof_case_studies knowledge. Empty array if there are none."),
  }),

  faq: z.array(z.object({ question: z.string(), answer: z.string() })),

  cta: z.object({ heading: z.string(), bodyMd: z.string(), buttonLabel: z.string() }),

  internalLinks: z
    .array(z.object({ anchor: z.string(), url: z.string(), reason: z.string() }))
    .describe("Only URLs that appear in the EVIDENCE or KNOWLEDGE sections. Empty array if none do."),

  localBusiness: z
    .object({
      legalName: z.string().nullable(),
      telephone: z.string().nullable(),
      streetAddress: z.string().nullable(),
      addressLocality: z.string().nullable(),
      addressRegion: z.string().nullable(),
      postalCode: z.string().nullable(),
      areaServed: z.array(z.string()),
    })
    .nullable()
    .describe("Only from knowledge docs. Null if the client's NAP details were not provided — never guess them."),

  dataGaps: z
    .array(z.string())
    .describe("Anything you needed but could not verify from KNOWLEDGE or EVIDENCE. Empty array if none."),
});

export type PagePackage = z.infer<typeof PagePackageSchema>;

/** Narrows an untyped `documents.package_json` to a page package, or null if it isn't one. */
export function parsePagePackage(value: unknown): PagePackage | null {
  const result = PagePackageSchema.safeParse(value);
  return result.success ? result.data : null;
}

/* ---------------------------- Rendering ---------------------------- */

/** Root-relative, lowercase, single leading slash, no trailing slash. */
export function normaliseUrlPath(path: string): string {
  const trimmed = path.trim().toLowerCase();
  if (!trimmed) return "/";
  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/, "");
  const leading = withoutOrigin.startsWith("/") ? withoutOrigin : `/${withoutOrigin}`;
  return leading.length > 1 ? leading.replace(/\/+$/, "") : leading;
}

/**
 * Markdown rendering — this is what lands in `documents.body_md`, so the editor,
 * word count, QA rules, copy-markdown and download flows all work unchanged.
 */
export function packageToMarkdown(pkg: PagePackage): string {
  const parts: string[] = [`# ${pkg.h1}`, "", `## ${pkg.hero.headline}`, "", pkg.hero.subheadline, "", pkg.hero.bodyMd];

  if (pkg.services.items.length > 0) {
    parts.push("", `## ${pkg.services.heading}`, "");
    for (const item of pkg.services.items) parts.push(`- **${item.name}** — ${item.description}`);
  }

  if (pkg.process.steps.length > 0) {
    parts.push("", `## ${pkg.process.heading}`, "");
    pkg.process.steps.forEach((step, i) => parts.push(`${i + 1}. **${step.title}** — ${step.description}`));
  }

  parts.push("", `## ${pkg.trustProof.heading}`, "", pkg.trustProof.bodyMd);
  if (pkg.trustProof.points.length > 0) {
    parts.push("");
    for (const point of pkg.trustProof.points) parts.push(`- ${point}`);
  }

  if (pkg.faq.length > 0) {
    parts.push("", "## Frequently asked questions", "");
    for (const item of pkg.faq) parts.push(`### ${item.question}`, "", item.answer, "");
  }

  parts.push("", `## ${pkg.cta.heading}`, "", pkg.cta.bodyMd, "", `**${pkg.cta.buttonLabel}**`);

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function md(value: string): string {
  return marked.parse(value, { async: false }) as string;
}

/**
 * Sectioned HTML export. Each block carries a `data-section` hook so a developer
 * can drop it into any template and target the parts they need.
 */
export function packageToHtml(pkg: PagePackage, jsonLd?: Record<string, unknown>[]): string {
  const sections: string[] = [];

  sections.push(
    [
      `<section data-section="hero">`,
      `  <h1>${esc(pkg.h1)}</h1>`,
      `  <p class="subheadline">${esc(pkg.hero.subheadline)}</p>`,
      indent(md(pkg.hero.bodyMd)),
      `</section>`,
    ].join("\n"),
  );

  if (pkg.services.items.length > 0) {
    sections.push(
      [
        `<section data-section="services">`,
        `  <h2>${esc(pkg.services.heading)}</h2>`,
        `  <ul>`,
        ...pkg.services.items.map(
          (i) => `    <li><strong>${esc(i.name)}</strong> — ${esc(i.description)}</li>`,
        ),
        `  </ul>`,
        `</section>`,
      ].join("\n"),
    );
  }

  if (pkg.process.steps.length > 0) {
    sections.push(
      [
        `<section data-section="process">`,
        `  <h2>${esc(pkg.process.heading)}</h2>`,
        `  <ol>`,
        ...pkg.process.steps.map(
          (s) => `    <li><strong>${esc(s.title)}</strong> — ${esc(s.description)}</li>`,
        ),
        `  </ol>`,
        `</section>`,
      ].join("\n"),
    );
  }

  sections.push(
    [
      `<section data-section="trust">`,
      `  <h2>${esc(pkg.trustProof.heading)}</h2>`,
      indent(md(pkg.trustProof.bodyMd)),
      ...(pkg.trustProof.points.length > 0
        ? [`  <ul>`, ...pkg.trustProof.points.map((p) => `    <li>${esc(p)}</li>`), `  </ul>`]
        : []),
      `</section>`,
    ].join("\n"),
  );

  if (pkg.faq.length > 0) {
    sections.push(
      [
        `<section data-section="faq">`,
        `  <h2>Frequently asked questions</h2>`,
        ...pkg.faq.flatMap((f) => [
          `  <div class="faq-item">`,
          `    <h3>${esc(f.question)}</h3>`,
          indent(md(f.answer), 4),
          `  </div>`,
        ]),
        `</section>`,
      ].join("\n"),
    );
  }

  sections.push(
    [
      `<section data-section="cta">`,
      `  <h2>${esc(pkg.cta.heading)}</h2>`,
      indent(md(pkg.cta.bodyMd)),
      `  <a class="cta-button" href="#contact">${esc(pkg.cta.buttonLabel)}</a>`,
      `</section>`,
    ].join("\n"),
  );

  if (jsonLd && jsonLd.length > 0) {
    // Escaping `<` keeps a stray "</script>" inside any string from closing the tag early.
    const payload = JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd, null, 2).replace(/</g, "\\u003c");
    sections.push(`<script type="application/ld+json">\n${payload}\n</script>`);
  }

  return sections.join("\n\n");
}

function indent(html: string, spaces = 2): string {
  const pad = " ".repeat(spaces);
  return html
    .trim()
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

/* ----------------------------- JSON-LD ----------------------------- */

export type JsonLdContext = {
  clientName: string;
  /** Bare domain from the client record, e.g. "harbourfamilylaw.com.au". Null = relative URLs only. */
  domain: string | null;
};

/** Absolute page URL when we know the domain, otherwise the root-relative path. */
export function pageUrl(pkg: PagePackage, ctx: JsonLdContext): string {
  const path = normaliseUrlPath(pkg.suggestedUrl);
  if (!ctx.domain) return path;
  const host = ctx.domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${host}${path}`;
}

/**
 * Service · FAQPage · LocalBusiness, per brief §6.7 — "as applicable" being the point:
 * FAQPage only when there are questions, LocalBusiness only when the client's NAP
 * details came through the knowledge docs. Nothing here is invented.
 */
export function buildJsonLd(pkg: PagePackage, ctx: JsonLdContext): Record<string, unknown>[] {
  const url = pageUrl(pkg, ctx);
  const nodes: Record<string, unknown>[] = [];
  const lb = pkg.localBusiness;
  const areaServed = lb?.areaServed?.filter((a) => a.trim()) ?? [];

  const provider: Record<string, unknown> = { "@type": "Organization", name: ctx.clientName };
  if (ctx.domain) provider.url = `https://${ctx.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  const service: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: pkg.serviceType ?? pkg.h1,
    description: pkg.metaDescription,
    url,
    provider,
  };
  if (areaServed.length > 0) {
    service.areaServed = areaServed.map((a) => ({ "@type": "Place", name: a }));
  }
  if (pkg.services.items.length > 0) {
    service.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: pkg.services.heading,
      itemListElement: pkg.services.items.map((item) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: item.name, description: item.description },
      })),
    };
  }
  nodes.push(service);

  if (pkg.faq.length > 0) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: pkg.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  if (lb) {
    const business: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: lb.legalName ?? ctx.clientName,
      url,
    };
    if (lb.telephone) business.telephone = lb.telephone;
    if (areaServed.length > 0) business.areaServed = areaServed.map((a) => ({ "@type": "Place", name: a }));

    const address: Record<string, string> = {};
    if (lb.streetAddress) address.streetAddress = lb.streetAddress;
    if (lb.addressLocality) address.addressLocality = lb.addressLocality;
    if (lb.addressRegion) address.addressRegion = lb.addressRegion;
    if (lb.postalCode) address.postalCode = lb.postalCode;
    if (Object.keys(address).length > 0) {
      business.address = { "@type": "PostalAddress", addressCountry: "AU", ...address };
    }
    nodes.push(business);
  }

  return nodes;
}

/** What the package view tells the user is missing, rather than quietly omitting it. */
export function jsonLdOmissions(pkg: PagePackage): string[] {
  const missing: string[] = [];
  if (pkg.faq.length === 0) missing.push("FAQPage — the package has no FAQ questions.");
  if (!pkg.localBusiness) {
    missing.push("LocalBusiness — no NAP details (name, address, phone) in the client's knowledge docs.");
  }
  return missing;
}
