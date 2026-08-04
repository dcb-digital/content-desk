# Content Desk — Product & Build Brief v2

**Owner:** DCB Digital (Derek + Courtney)
**Date:** 3 August 2026
**Status:** Approved to build — start tomorrow
**Replaces:** DCB-Content-Desk-Build-Brief.md (draft v1)

---

## 1. What we're building and why

**Content Desk** is a multi-client SEO content operations system. It holds each client's knowledge, objectives, and SEO evidence; generates dated content plans; writes evidence-grounded posts and page packages; forces quality gates at the right moments; and exports or publishes the result. Any team member can run it. Nothing ships without human approval.

**Why now:** Paperclip AI proved the concept but is buggy and not ours. We currently lose 15–20 hrs/month per client to content ops. Content Desk is a core module of the DCB AI OS — the machine that lets 2 people serve 40+ clients — and is designed from day one to be sold to other small agencies, who all have this exact problem.

**One-line pitch (for the eventual SaaS):**
*"The content team in a box for small SEO agencies — every article grounded in the client's real data, planned on a calendar, QA'd before it ships."*

### What "beat Paperclip" means (the four pillars)

These four things are what Paperclip does well. Content Desk must match or beat all four — they are the product's north star, not optional features:

1. **Research grounding** — every plan item and draft traces to real evidence (client data, keyword data, SERP context). Never invented metrics. Show the receipts on every document.
2. **End-to-end automation** — plan → brief → draft → QA in minimal clicks, with true batch generation ("draft all 8 approved items overnight").
3. **Editor & output quality** — a genuinely pleasurable writing/editing surface (Notion-grade editor, streaming generation, one-click regenerate-section) producing structurally complete, publish-ready output.
4. **Direct CMS publishing** — push approved content to WordPress as drafts (v1.1). Where we beat Paperclip: publishing sits *behind* an approval gate, so juniors can't ship slop.

### What Content Desk has that Paperclip never will

- **Client memory** — pinned brand voice, banned claims, proof points, ICP per client, used on every generation.
- **Objectives-driven planning** — plans built to hit the client's stated business goal, not just keyword volume.
- **Agency workflow** — multi-client, roles, QA gates, per-item status, who-did-what.
- **Our data moat** — every human edit to a draft is diffed and logged (Edit Ledger), and every published item can later be joined to outcomes (Outcome Ledger). This compounds into training data no competitor can copy.

---

## 2. Platform decision (final)

**Next.js (App Router) + Vercel + Supabase. Built by vibe-coding with Claude Code.**

| Criterion | Why this stack wins |
|---|---|
| Ownership / sellability | 100% our code in our GitHub repo. No platform lock-in (Base44 ruled out for exactly this — see AI OS strategy notes). Sellable, auditable, due-diligence-clean. |
| Sexy UI | shadcn/ui + Tailwind is the current gold standard for exactly this kind of app; streaming UI via Vercel AI SDK. |
| Speed to build | Supabase gives auth, Postgres, row-level security, and file storage on day one — zero backend boilerplate. Claude Code scaffolds the rest. |
| Easy to improve forever | Standard TypeScript codebase. Every future improvement is a normal PR. Claude Code, Cursor, or a hired dev can all work on it. |
| Multi-tenant SaaS path | Supabase RLS = tenant isolation enforced at the database layer, not in app code. Add Stripe later without re-architecture. |
| Cost | ~$0–45/month until it has real usage (Vercel Hobby/Pro + Supabase free/Pro). LLM tokens are the only real variable cost. |

**Core stack (pinned):**

- Next.js 15+ (App Router, Server Components, Server Actions) + TypeScript
- Supabase: Postgres, Auth (email + Google), Storage (uploads), RLS
- Drizzle ORM (typed schema, migrations in repo)
- Tailwind CSS 4 + shadcn/ui + Lucide icons
- **Vercel AI SDK** — single abstraction over Anthropic / OpenAI / OpenRouter, streaming built in
- **TipTap editor** (Novel-style) for the document editor — Notion-grade editing
- **Inngest** for background/batch jobs (batch drafting, syncs) — free tier, Vercel-native
- Zod everywhere (LLM output validation, forms, API boundaries)
- Vitest + Playwright (smoke tests on the core loop only — don't gold-plate)

**Explicitly not:** Base44 (lock-in), Lovable (generated-code debt for a long-life product), Replit hosting (no advantage over Vercel), separate backend service (Supabase + server actions is enough), microservices, Redis, Kubernetes. Boring beats clever.

---

## 3. Product principles

1. **Evidence or silence.** No metric, ranking, or statistic appears in any output unless it traces to a stored evidence snapshot or knowledge doc. If data is missing, the UI and the output say so plainly.
2. **Human gates, not human labor.** AI does 100% of production. Humans decide at exactly three gates: approve plan, approve brief (optional, skippable per client), approve draft. Everything else is automatic.
3. **Any team member can drive.** If it needs Derek to operate, it's mis-designed. Empty states teach. Defaults are smart. The happy path is obvious.
4. **A pleasure to use.** Sub-second navigation, streaming generation you can watch, keyboard-first (⌘K everywhere), optimistic UI, zero modal hell. The bar: you'd rather be in Content Desk than in ChatGPT.
5. **Multi-tenant from commit #1.** `workspace_id` on every table, enforced by RLS. DCB is just tenant #1.
6. **Log the judgment.** Every human edit to AI output is captured as a diff. This is the moat; it costs almost nothing to build now and is impossible to backfill later.

---

## 4. Scope

### v1 — Core Loop (build now, ~2–3 weeks of vibe-coding)

The complete loop, with **file-upload evidence** instead of live API connectors:

> Create client → add knowledge → set objectives → upload evidence (GSC/GA4/Ahrefs/SEMrush CSV exports) → auto-generate opportunities → generate content plan (7/30/60/90-day, chosen frequency) → approve plan → generate briefs → generate drafts (single + batch) → automated QA flags → human edit & approve → export (MD/HTML/JSON/copy).

### v1.1 — Live data + publishing (weeks 4–6)

- Google OAuth: **GSC** then **GA4** live sync
- **Ahrefs API** sync (we already hold a key); SEMrush after
- **WordPress draft publishing** via REST API / application passwords (approved items only)
- Client approval portal (read-only share link with approve/comment)

### v2 — Agency SaaS

- Workspace invites + roles UI, Stripe billing, white-label theming, onboarding flow, marketing site. **No rebuild required** — v1 architecture already supports it.

### Non-goals (permanent for v1/v1.1)

- Site builder / CMS replacement — "pages" means **on-page copy packages**, not rendered websites
- Rank tracking (Ahrefs/SEMrush do this)
- Auto-publish without approval — never
- Mobile apps
- Sales/diagnostic tooling (that's the Diagnose tool)

---

## 5. Domain model

```
Workspace (tenant — DCB is #1)
 ├── User / Membership (role: admin | member)
 ├── Settings (LLM provider + keys, default model, theme)
 └── Client
      ├── KnowledgeDoc     (brand voice, services, banned claims… pinned or retrievable)
      ├── Objective        (structured wizard output + summary; versioned snapshots)
      ├── EvidenceSource   (file upload v1; gsc|ga4|ahrefs|semrush connector v1.1)
      │     └── EvidenceSnapshot (normalized queries/pages/keywords JSON, period, provider)
      ├── Opportunity      (type, score, evidence_refs[], status)
      ├── ContentPlan      (horizon, frequency, focus mode, objectives_snapshot, status)
      │     └── PlanItem   (post|page|refresh, date, keyword, opportunity_ids[], status)
      └── Document         (brief|draft, TipTap JSON + MD, versions, QA results, status)
           ├── EditDiff    (AI version vs human-approved version — the Edit Ledger)
           └── GenerationLog (provider, model, tokens, cost, prompt_version, evidence used)
```

**Document status pipeline (single source of truth for the whole app):**
`planned → briefed → brief_approved → drafting → qa_flagged → in_review → approved → exported/published`

---

## 6. Feature specification

### 6.1 Clients & knowledge

- Client record: name, domain, industry/vertical, locale (default `en-AU`), notes.
- **Knowledge tab** (Claude Projects-style): markdown docs with type tags — `brand_voice`, `services`, `offers`, `locations`, `icp`, `proof_case_studies`, `banned_claims`, `competitors`, `product_facts`, `other`.
- Each doc: **pin** ("always include in every generation") or retrievable (included when tags/keywords match the task). Token estimate shown; soft warning when pinned budget exceeds ~8k tokens.
- Create in-app (markdown editor) or upload `.md/.txt/.docx/.pdf` (extract text on upload).
- **Onboarding accelerator:** "Generate starter knowledge" — paste the client's website URL, LLM drafts `services`, `locations`, and a `brand_voice` starting point for human review. Turns 2 hours of setup into 10 minutes.

### 6.2 Objectives wizard

Seven quick steps, not a blank textarea: primary goal → success metric (their words + optional number) → priority services → priority locations → audience notes → constraints/compliance/banned topics → anything else. Stored as structured JSON + an LLM-written summary paragraph (editable). Plans **snapshot** objectives at generation time so mid-plan edits don't silently rewrite context.

### 6.3 Evidence (v1 = files)

- Upload CSV/XLSX/PDF exports; user picks source type (GSC, GA4, Ahrefs, SEMrush, other) — parser auto-detects known column headers and confirms.
- Parsed into **NormalizedEvidence**: `queries[] {query, clicks, impressions, ctr, position}`, `pages[] {url, clicks, impressions, sessions}`, `keywords[] {keyword, volume, position, url, difficulty}`, `content_gap[] {keyword, volume, competitor}` — with period and provenance on every snapshot.
- Raw snapshot viewer (sortable table) so staff can eyeball what the system "knows".
- v1.1 swaps the file parser for live connectors behind the **same** `EvidenceProvider` interface — the rest of the app never changes:

```ts
interface EvidenceProvider {
  id: 'file' | 'gsc' | 'ga4' | 'ahrefs' | 'semrush'
  test(): Promise<Status>
  sync(period: DateRange): Promise<NormalizedEvidence>
}
```

### 6.4 Opportunity engine

Deterministic rules first, LLM labeling second (cheap, explainable, no hallucinated opportunities):

| Rule | Signal | Suggested action |
|---|---|---|
| Striking distance | position 5–20, decent impressions | refresh / optimize |
| High impressions, low CTR | CTR well below position-curve expectation | title/meta rewrite |
| Declining page | clicks down ≥30% period-over-period | refresh |
| Keyword, no page | volume exists, no ranking URL | new post/page |
| Competitor gap | Ahrefs/SEMrush gap keyword | new post/page |
| Cannibalization | multiple URLs, same query intent | consolidate |

Each opportunity: type, priority score (traffic potential × ease), evidence refs, suggested content type, status (`open | planned | dismissed`). LLM adds a one-sentence human-readable rationale. Board view sorted by score; one click sends an opportunity into a plan.

### 6.5 Content plans

- **Create flow:** horizon (7/30/60/90 days) → frequency (N posts per week/month, N pages per month, N refreshes per month) → focus mode (opportunities-first *default* / objectives-first / balanced) → generate.
- Output: editable calendar + table. Each PlanItem: date, type, working title, target keyword + intent, linked opportunities, owner, status.
- Actions: regenerate whole plan (confirm-warn), regenerate single row, drag to reorder/redate, kill item, add manual item.
- **Approve plan** gate unlocks brief/draft generation (and batch mode).

### 6.6 Generation engine (the brain)

**Provider abstraction** via Vercel AI SDK. Workspace settings: provider (`anthropic | openai | openrouter`), encrypted API keys, default model, per-client override, test-connection button. Every call logged to `GenerationLog` (provider, model, tokens, est. cost, action, client, document, prompt version). Never log key material.

**Prompt assembly (fixed order, versioned):**

1. System: Content Desk rules — AU English, EEAT, no fabricated stats/rankings, cite evidence refs, banned-claims enforcement
2. Objectives snapshot
3. Pinned knowledge docs
4. Retrieved knowledge (tag/keyword match)
5. Opportunity + relevant evidence excerpts **only** (never the full snapshot)
6. Plan item / approved brief
7. Task instruction (plan | brief | draft | refresh | section-rewrite)

**Prompt library lives in the database**, versioned, editable by admins in the UI. Improving output quality must never require a deploy — this is how we "keep making it better" weekly. Every GenerationLog records which prompt version produced it, so we can compare.

**Structured output:** briefs and page packages generate as Zod-validated JSON (retry once on validation failure); article bodies stream as markdown into the editor in real time.

**Batch mode:** "Draft all approved items" → Inngest queue, sequential with progress UI, resumable, per-item failure isolation. Kick it off at 5pm, QA in the morning.

### 6.7 Output packages

**Post:** 3 title options · meta title/description · slug · outline · full article (MD) · FAQ block · internal link suggestions (from evidence pages) · CTA block · image prompts · **Sources & evidence panel** (what grounded this piece).

**Page package (service/location/money page):** SEO title, meta, H1 · hero copy · trust/proof section (pulls from `proof_case_studies` knowledge only) · services/inclusions · process · FAQ · CTA · suggested URL · internal links · JSON-LD (Service/FAQ/LocalBusiness as applicable) · sectioned HTML export.

**Refresh:** current URL · "what's wrong" diagnosis from evidence · full rewritten MD · change list (before → after per section).

### 6.8 QA engine (automated flags before human review)

Runs on every draft, results shown as a checklist on the document; items with flags enter `qa_flagged` status:

- Word count below type threshold (thin content)
- Primary keyword missing from title/H1/first 100 words
- **Unverified numbers** — any statistic without an evidence ref or knowledge citation (the Paperclip killer feature; their reviews flag exactly this failure)
- Banned phrases/claims from client knowledge
- Missing CTA / missing FAQ (per type)
- Cannibalization warning (similar live PlanItem or ranked URL)
- AU English spellcheck pass (organise/optimise/colour)

Flags are advisory — a human can override each with one click, and overrides are logged.

### 6.9 Editor & review UX

- **Three-pane document view:** brief (left, collapsible) · TipTap editor (center) · evidence + QA + knowledge-used panel (right).
- Streaming generation renders into the editor live; select any section → "rewrite this section" with an instruction.
- Version history with restore; **on approval, the diff between last AI version and approved version is stored** (Edit Ledger).
- Export: copy MD / copy HTML / download JSON package. v1.1: "Push to WordPress as draft."

### 6.10 App shell & screens

Left nav: **Clients** · Settings · Prompt Library (admin). Client subnav: **Overview · Knowledge · Objectives · Evidence · Opportunities · Plans · Documents**.

1. Client list (cards: open items, last activity, plan health)
2. Client overview (objectives summary, evidence freshness, active plan progress, docs awaiting review)
3. Knowledge library
4. Objectives wizard
5. Evidence: uploads + snapshot viewer (+ connections in v1.1)
6. Opportunities board
7. Plan builder (calendar + table toggle)
8. Document editor (three-pane)
9. Workspace settings (LLM providers/keys, members, theme)
10. Prompt library (admin)

**Design language:** clean, dense-but-calm agency tool. shadcn/ui defaults + a restrained DCB accent color (theme tokens → trivially white-labeled in v2). ⌘K command palette (jump to client/doc, trigger generate). Every empty state has one clear CTA. Dark mode from day one. Skeleton loaders, optimistic updates, toasts not modals.

---

## 7. Security & tenancy

- `workspace_id` on every row; **Supabase RLS policies enforce isolation** — a leaked query can't cross tenants.
- API keys: AES-GCM encrypted at rest (app-level, key in env), masked in UI, never logged, never sent to the client bundle.
- Roles v1: `admin` (keys, members, prompts, all clients), `member` (assigned clients, generate/edit). Client-facing viewer role arrives with the portal in v1.1.
- Supabase Auth: email/password + Google SSO. Session on server via cookies (Next.js middleware).
- Audit trail: GenerationLog + status-change log per document (who moved what, when).

---

## 8. Build plan — starting tomorrow

### Day 1 (tomorrow): repo + skeleton

1. `create-next-app` (TS, App Router, Tailwind) → GitHub → Vercel connect
2. Supabase project (Sydney region) → Drizzle schema for Workspace/User/Client/KnowledgeDoc → first migration → RLS policies
3. Auth (Supabase) + app shell (nav, client list, dark mode) with shadcn/ui
4. Seed script: DCB workspace + 1 real client + sample knowledge docs
5. Write `CLAUDE.md` (section 11) so every future session is productive

**Day 1 done =** you log in, see the shell, create a client. Deployed on Vercel.

### Week 1: knowledge → objectives → first generation

- Knowledge CRUD + pinning + uploads + starter-knowledge generator
- Objectives wizard + snapshots
- LLM provider settings + encrypted keys + test connection
- **Milestone: generate a grounded draft post from knowledge + objectives alone, streaming into the TipTap editor.** (Prove the brain loop before touching SEO data.)

### Week 2: evidence → opportunities → plans

- File upload + CSV/XLSX parsing → NormalizedEvidence + snapshot viewer
- Opportunity engine (rules + LLM rationale) + board
- Plan generation (horizon/frequency/focus) + calendar/table editor + approval gate

### Week 3: full pipeline + QA + polish

- Brief → draft → QA flags → review → approve → export, incl. page packages + refreshes
- Batch drafting via Inngest
- Edit Ledger diffs on approval
- ⌘K palette, empty states, keyboard flows, prompt library UI
- **Milestone: run one real DCB client end-to-end for their actual month's content. Ship it to the client.**

### Weeks 4–6 (v1.1): GSC OAuth → Ahrefs API → GA4 → WordPress draft push → client approval portal

**Rule for the vibe-coding sessions:** one vertical slice per session, always deployable, never two half-built features. Each session ends with a Vercel deploy Courtney can click.

---

## 9. Acceptance tests (v1 done = all pass)

1. Create client, add 3 knowledge docs (1 pinned), complete objectives wizard
2. Upload a real GSC CSV → snapshot viewable → opportunities appear with correct rule types and evidence refs
3. Create 30-day plan (2 posts/wk + 1 page/mo) → correct item count ±1, sensible dates, keywords tied to opportunities
4. Approve plan → batch-draft 4 items → all complete with progress UI; one intentional failure doesn't kill the batch
5. Draft contains zero unverified statistics; QA correctly flags a planted fake stat and a planted banned phrase
6. Page package includes meta, H1, all sections, FAQ, valid JSON-LD
7. Switch provider Anthropic → OpenRouter → regeneration still works; GenerationLog shows both runs with prompt versions
8. Edit a draft, approve → EditDiff row exists with the exact changes
9. Keys masked in UI, encrypted in DB; second workspace sees nothing of the first (RLS test)
10. Courtney runs a full client cycle with **zero** questions to Derek

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Hallucinated metrics/rankings | Evidence-only prompt rules + QA "unverified numbers" flag + refuse-if-no-data behavior |
| Juniors ship slop | QA gate + approval statuses are structural, not optional; publishing only from `approved` |
| Context overflow on big clients | Pinned-token budget warnings; retrieved (not dumped) knowledge; evidence excerpts only |
| LLM cost creep | Per-run cost logging from day 1; cheap model default for briefs/plans, premium for drafts |
| Scope creep → "website builder" | Page = copy package. Written into non-goals; repeat in CLAUDE.md |
| Solo-builder stall | Vertical slices, always deployable, acceptance tests as the definition of done |
| Ahrefs/SEMrush API cost (v1.1) | Cache 7 days, capped rows, file-upload fallback always remains |

**Success metrics (DCB internal):** time from "need content" → approved draft down 50%+; % drafts needing major rewrite < 20%; plan adherence > 85%; Courtney fully self-serve.

---

## 11. CLAUDE.md seed (drop in repo root, day 1)

```markdown
# Content Desk
Multi-tenant SEO content ops app for agencies. DCB Digital is tenant #1; product will be sold to other agencies.

## Stack (do not deviate)
Next.js App Router + TS · Supabase (Postgres/Auth/Storage, RLS on) · Drizzle ·
Tailwind + shadcn/ui · Vercel AI SDK (anthropic|openai|openrouter) · TipTap · Inngest · Zod

## Iron rules
1. workspace_id on every table; every query RLS-scoped. No exceptions.
2. Never render or generate a metric without an evidence ref. Missing data = say so.
3. Document status pipeline is the single source of truth:
   planned → briefed → brief_approved → drafting → qa_flagged → in_review → approved → exported
4. Prompts live in the DB (versioned), not in code.
5. Secrets: AES-GCM encrypted, masked in UI, never logged.
6. AU English (en-AU) default in all generated content.
7. "Page" = on-page copy package. Never build page-rendering/site-builder features.
8. Ship vertical slices; main is always deployable.

## Key files
/src/db/schema.ts · /src/lib/ai/ (provider abstraction, prompt assembly) ·
/src/lib/evidence/ (providers + normalizer) · /src/lib/qa/ (flag rules) · /src/inngest/
```

---

## 12. Open decisions (defaults apply unless changed)

| Decision | Default |
|---|---|
| Public name | Content Desk (rename before SaaS launch is fine — it's a config value) |
| Brief approval gate | On by default, skippable per client (small clients go plan → draft) |
| Default models | Premium model for drafts; fast/cheap model for plans, briefs, QA labeling |
| SEMrush | Supported after Ahrefs; either source is sufficient |
| Client portal | v1.1, share-link first, accounts later |
| Stripe | v2 only; feature-flag table exists from v1 |

---

## 13. Env (day 1)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
ENCRYPTION_KEY=            # AES-GCM, 32 bytes
APP_URL=http://localhost:3000

# Workspace LLM keys are stored encrypted in DB; these are dev fallbacks
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
DEFAULT_LLM_PROVIDER=anthropic

INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# v1.1
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
AHREFS_API_KEY=
```

---

**Done (v1) =** any DCB team member can take a client from zero to an approved, evidence-grounded month of content — planned, drafted, QA'd, exported — without touching ChatGPT, and without Derek in the loop except at approval gates.

*End of brief.*
