/**
 * Content Desk — Drizzle schema
 * Iron rule #1: workspace_id on every tenant table. RLS enforces isolation (see supabase/rls-policies.sql).
 * Document status pipeline is the single source of truth:
 * planned → briefed → brief_approved → drafting → qa_flagged → in_review → approved → exported
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  real,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ----------------------------- Enums ----------------------------- */

export const memberRole = pgEnum("member_role", ["admin", "member"]);

export const llmProvider = pgEnum("llm_provider", [
  "anthropic",
  "openai",
  "openrouter",
]);

export const knowledgeDocType = pgEnum("knowledge_doc_type", [
  "brand_voice",
  "services",
  "offers",
  "locations",
  "icp",
  "proof_case_studies",
  "banned_claims",
  "competitors",
  "product_facts",
  "other",
]);

export const evidenceProviderId = pgEnum("evidence_provider_id", [
  "file",
  "gsc",
  "ga4",
  "ahrefs",
  "semrush",
]);

export const opportunityType = pgEnum("opportunity_type", [
  "striking_distance",
  "low_ctr",
  "declining_page",
  "keyword_no_page",
  "competitor_gap",
  "cannibalization",
  "manual",
]);

export const opportunityStatus = pgEnum("opportunity_status", [
  "open",
  "planned",
  "dismissed",
]);

export const planStatus = pgEnum("plan_status", [
  "draft",
  "approved",
  "archived",
]);

export const planFocusMode = pgEnum("plan_focus_mode", [
  "opportunities_first",
  "objectives_first",
  "balanced",
]);

export const planItemType = pgEnum("plan_item_type", [
  "post",
  "page",
  "refresh",
]);

export const documentStatus = pgEnum("document_status", [
  "planned",
  "briefed",
  "brief_approved",
  "drafting",
  "qa_flagged",
  "in_review",
  "approved",
  "exported",
  "published",
  "killed",
]);

export const documentKind = pgEnum("document_kind", ["brief", "draft"]);

export const batchRunStatus = pgEnum("batch_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const generationAction = pgEnum("generation_action", [
  "plan",
  "brief",
  "draft",
  "refresh",
  "section_rewrite",
  "qa_label",
  "opportunity_label",
  "starter_knowledge",
  "page_package",
]);

/* --------------------------- Tenancy ------------------------------ */

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  // Theme tokens for white-labeling later (accent color, logo url, etc.)
  theme: jsonb("theme").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Mirrors supabase auth.users (id = auth.uid()). Profile-only fields here. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // = auth.users.id
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("memberships_ws_user_uq").on(t.workspaceId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

/** One row per workspace. LLM keys AES-GCM encrypted at app layer before insert. */
export const workspaceSettings = pgTable("workspace_settings", {
  workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  defaultProvider: llmProvider("default_provider").notNull().default("anthropic"),
  /** { anthropic?: { encKey, model }, openai?: {...}, openrouter?: {...} } — encKey = ciphertext, never plaintext */
  providers: jsonb("providers").$type<Record<string, { encKey: string; model: string }>>().default({}),
  /** cheap model used for plans/briefs/QA labeling */
  fastModel: text("fast_model"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
  },
  (t) => [uniqueIndex("feature_flags_ws_key_uq").on(t.workspaceId, t.key)],
);

/* ---------------------------- Clients ----------------------------- */

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    locale: varchar("locale", { length: 10 }).notNull().default("en-AU"),
    /** per-client LLM override, null = workspace default */
    llmOverride: jsonb("llm_override").$type<{ provider: string; model: string } | null>(),
    /** brief approval gate on by default; small clients can skip plan→draft */
    briefGateEnabled: boolean("brief_gate_enabled").notNull().default(true),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("clients_ws_idx").on(t.workspaceId)],
);

/* --------------------------- Knowledge ----------------------------- */

export const knowledgeDocs = pgTable(
  "knowledge_docs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: knowledgeDocType("type").notNull().default("other"),
    bodyMd: text("body_md").notNull().default(""),
    /** pinned docs are injected into every generation for this client */
    pinned: boolean("pinned").notNull().default(false),
    tags: jsonb("tags").$type<string[]>().default([]),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    sourceFilePath: text("source_file_path"), // supabase storage path if uploaded
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("knowledge_client_idx").on(t.clientId)],
);

/* --------------------------- Objectives ---------------------------- */

export const objectives = pgTable(
  "objectives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    /** structured wizard output: goal, metric, services[], locations[], audience, constraints, freeText */
    data: jsonb("data").$type<{
      primaryGoal: string;
      successMetric: string;
      numericTarget?: number | null;
      priorityServices: string[];
      priorityLocations: string[];
      audienceNotes?: string;
      constraints?: string;
      freeText?: string;
    }>().notNull(),
    summaryMd: text("summary_md").notNull().default(""),
    /** only one current row per client; plans snapshot the row they used */
    isCurrent: boolean("is_current").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("objectives_client_idx").on(t.clientId)],
);

/* ---------------------------- Evidence ----------------------------- */

export const evidenceSources = pgTable(
  "evidence_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    provider: evidenceProviderId("provider").notNull().default("file"),
    label: text("label").notNull(), // e.g. "GSC export Jul 2026" or "GSC (live)"
    /** for provider=file: storage path + declared type; for connectors: encrypted auth payload (v1.1) */
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    staffNotes: text("staff_notes"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("evidence_sources_client_idx").on(t.clientId)],
);

/** NormalizedEvidence — one snapshot per sync/parse. Everything grounding-related points here. */
export const evidenceSnapshots = pgTable(
  "evidence_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => evidenceSources.id, { onDelete: "cascade" }),
    provider: evidenceProviderId("provider").notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    /** { queries, pages, keywords, contentGap, backlinks, dimensions, unmapped } — see NormalizedEvidence */
    data: jsonb("data").$type<NormalizedEvidence>().notNull(),
    rowCounts: jsonb("row_counts").$type<Record<string, number>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("evidence_snapshots_client_idx").on(t.clientId)],
);

/**
 * Any column the parser couldn't map to a typed field is preserved verbatim here,
 * keyed by its original header. Guarantees an import never silently loses data.
 */
export type EvidenceExtras = { extra?: Record<string, string> };

/** Per-query rows (GSC). `*Prev` fields come from date-comparison exports. */
export type EvidenceQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicksPrev?: number;
  impressionsPrev?: number;
  ctrPrev?: number;
  positionPrev?: number;
  /** secondary dimensions when the export includes them */
  page?: string;
  country?: string;
  device?: string;
  date?: string;
  searchAppearance?: string;
} & EvidenceExtras;

/** Per-URL rows (GSC pages, GA4 landing pages / page paths). */
export type EvidencePageRow = {
  url: string;
  title?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  clicksPrev?: number;
  impressionsPrev?: number;
  sessions?: number;
  users?: number;
  newUsers?: number;
  views?: number;
  engagementRate?: number;
  bounceRate?: number;
  avgEngagementTimeSec?: number;
  eventCount?: number;
  conversions?: number;
  revenue?: number;
} & EvidenceExtras;

/** Keyword rows (Ahrefs, SEMrush, keyword research exports). */
export type EvidenceKeywordRow = {
  keyword: string;
  volume?: number;
  position?: number;
  previousPosition?: number;
  url?: string;
  difficulty?: number;
  cpc?: number;
  traffic?: number;
  trafficValue?: number;
  trafficPercent?: number;
  intent?: string;
  parentTopic?: string;
  serpFeatures?: string;
  competitiveDensity?: number;
  results?: number;
  country?: string;
  trend?: string;
} & EvidenceExtras;

/** One row per (keyword, competitor) pair from content-gap exports. */
export type EvidenceContentGapRow = {
  keyword: string;
  competitor: string;
  volume?: number;
  competitorPosition?: number;
  ourPosition?: number;
} & EvidenceExtras;

/** Backlink / referring-page exports. */
export type EvidenceBacklinkRow = {
  sourceUrl: string;
  sourceTitle?: string;
  targetUrl?: string;
  anchor?: string;
  domainRating?: number;
  authorityScore?: number;
  nofollow?: boolean;
  firstSeen?: string;
  lastSeen?: string;
} & EvidenceExtras;

/**
 * Non-URL breakdowns: GSC countries/devices/dates/search appearance,
 * GA4 channel groups, source/medium, etc.
 */
export type EvidenceDimensionRow = {
  /** the dimension's column name, e.g. "country", "device", "date" */
  dimension: string;
  value: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  sessions?: number;
  users?: number;
  conversions?: number;
  revenue?: number;
} & EvidenceExtras;

/** A file whose shape we couldn't classify — kept verbatim so nothing is dropped. */
export type EvidenceUnmappedTable = {
  label?: string;
  headers: string[];
  rows: Record<string, string>[];
};

export type NormalizedEvidence = {
  queries?: EvidenceQueryRow[];
  pages?: EvidencePageRow[];
  keywords?: EvidenceKeywordRow[];
  contentGap?: EvidenceContentGapRow[];
  backlinks?: EvidenceBacklinkRow[];
  dimensions?: EvidenceDimensionRow[];
  unmapped?: EvidenceUnmappedTable[];
};

/* -------------------------- Opportunities -------------------------- */

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    type: opportunityType("type").notNull(),
    status: opportunityStatus("status").notNull().default("open"),
    /** traffic potential × ease, 0–100 */
    score: real("score").notNull().default(0),
    title: text("title").notNull(),
    /** one-sentence LLM rationale */
    rationale: text("rationale"),
    suggestedType: planItemType("suggested_type").notNull().default("post"),
    /** rule inputs: query/url/metrics rows that triggered the rule */
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    /** grounding: which snapshots (and row keys) support this */
    evidenceRefs: jsonb("evidence_refs").$type<{ snapshotId: string; rows?: string[] }[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("opportunities_client_idx").on(t.clientId),
    index("opportunities_status_idx").on(t.clientId, t.status),
  ],
);

/* ----------------------------- Plans ------------------------------- */

export const contentPlans = pgTable(
  "content_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    horizonDays: integer("horizon_days").notNull(), // 7 | 30 | 60 | 90
    /** { posts: {n, per: 'week'|'month'}, pages: {...}, refreshes: {...} } */
    frequency: jsonb("frequency").$type<Record<string, { n: number; per: "week" | "month" }>>().notNull(),
    focusMode: planFocusMode("focus_mode").notNull().default("opportunities_first"),
    status: planStatus("status").notNull().default("draft"),
    startDate: date("start_date").notNull(),
    /** frozen copy of objectives row at generation time */
    objectivesSnapshot: jsonb("objectives_snapshot").$type<Record<string, unknown>>().notNull(),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("plans_client_idx").on(t.clientId)],
);

export const planItems = pgTable(
  "plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").notNull().references(() => contentPlans.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    type: planItemType("type").notNull(),
    scheduledDate: date("scheduled_date").notNull(),
    workingTitle: text("working_title").notNull(),
    targetKeyword: text("target_keyword"),
    searchIntent: text("search_intent"),
    /** for refreshes: the live URL being refreshed */
    targetUrl: text("target_url"),
    status: documentStatus("status").notNull().default("planned"),
    ownerId: uuid("owner_id").references(() => users.id),
    opportunityIds: jsonb("opportunity_ids").$type<string[]>().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("plan_items_plan_idx").on(t.planId),
    index("plan_items_client_status_idx").on(t.clientId, t.status),
  ],
);

/* --------------------------- Documents ----------------------------- */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    planItemId: uuid("plan_item_id").references(() => planItems.id, { onDelete: "set null" }),
    kind: documentKind("kind").notNull(),
    title: text("title").notNull(),
    /** structured package (brief JSON / page package JSON / post metadata) — Zod-validated on write */
    packageJson: jsonb("package_json").$type<Record<string, unknown>>().default({}),
    /** article body: TipTap JSON is canonical, MD kept in sync for export/prompting */
    bodyTiptap: jsonb("body_tiptap").$type<Record<string, unknown> | null>(),
    bodyMd: text("body_md").notNull().default(""),
    status: documentStatus("status").notNull().default("drafting"),
    /** QA engine output: [{ rule, level, message, overriddenBy? }] */
    qaResults: jsonb("qa_results").$type<
      { rule: string; level: "flag" | "warn"; message: string; overriddenBy?: string }[]
    >().default([]),
    /** grounding shown in the right-hand panel */
    knowledgeDocIds: jsonb("knowledge_doc_ids").$type<string[]>().default([]),
    evidenceRefs: jsonb("evidence_refs").$type<{ snapshotId: string; rows?: string[] }[]>().default([]),
    version: integer("version").notNull().default(1),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("documents_client_idx").on(t.clientId),
    index("documents_plan_item_idx").on(t.planItemId),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    bodyMd: text("body_md").notNull(),
    packageJson: jsonb("package_json").$type<Record<string, unknown>>().default({}),
    /** 'ai' for generated versions, user id for human saves */
    author: text("author").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("doc_versions_uq").on(t.documentId, t.version)],
);

/** Edit Ledger — the moat. Diff between last AI version and human-approved version. */
export const editDiffs = pgTable(
  "edit_diffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    aiVersion: integer("ai_version").notNull(),
    approvedVersion: integer("approved_version").notNull(),
    /** unified diff of markdown bodies */
    diffText: text("diff_text").notNull(),
    /** structured stats: { linesAdded, linesRemoved, sectionsChanged[] } */
    stats: jsonb("stats").$type<Record<string, unknown>>().default({}),
    editedBy: uuid("edited_by").references(() => users.id),
    /** vertical of the client at time of edit — lets edits compound within verticals */
    industry: text("industry"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("edit_diffs_client_idx").on(t.clientId)],
);

/* --------------------------- Batch runs ---------------------------- */

/**
 * One row per "draft all items" run (brief §6.6). Inngest owns execution and
 * retries; this row owns what the operator sees, because the queue can't tell
 * them which of tonight's four articles failed and why.
 *
 * Per-item results live in `items` rather than a child table: a run is always
 * read and written whole, and the batch is sequential, so there is no
 * concurrent-write case to lose.
 */
export type BatchRunItem = {
  planItemId: string;
  workingTitle: string;
  /** plan_items.type at queue time */
  type: "post" | "page" | "refresh";
  /** what this item produces — respects the client's brief gate */
  action: "brief" | "draft";
  status: "pending" | "running" | "done" | "failed";
  documentId?: string;
  error?: string;
};

export const batchRuns = pgTable(
  "batch_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").notNull().references(() => contentPlans.id, { onDelete: "cascade" }),
    status: batchRunStatus("status").notNull().default("queued"),
    total: integer("total").notNull().default(0),
    succeeded: integer("succeeded").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    items: jsonb("items").$type<BatchRunItem[]>().notNull().default([]),
    /** set only when the run itself couldn't proceed — per-item failures live in `items` */
    error: text("error"),
    startedBy: uuid("started_by").references(() => users.id),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("batch_runs_plan_idx").on(t.planId),
    index("batch_runs_client_started_idx").on(t.clientId, t.startedAt),
  ],
);

/* ------------------------ Prompts & logging ------------------------ */

/** Prompt library lives in DB (iron rule #4). Improving prompts never requires a deploy. */
export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(), // e.g. 'system_rules', 'task_draft_post'
    version: integer("version").notNull().default(1),
    body: text("body").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("prompts_ws_key_version_uq").on(t.workspaceId, t.key, t.version),
    index("prompts_ws_key_active_idx").on(t.workspaceId, t.key, t.isActive),
  ],
);

export const generationLogs = pgTable(
  "generation_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    action: generationAction("action").notNull(),
    provider: llmProvider("provider").notNull(),
    model: text("model").notNull(),
    /** { key: version } of every prompt used in assembly */
    promptVersions: jsonb("prompt_versions").$type<Record<string, number>>().default({}),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    /** Null = no published rate for this model. Distinct from 0, which means free. */
    estCostUsd: real("est_cost_usd"),
    durationMs: integer("duration_ms"),
    success: boolean("success").notNull().default(true),
    error: text("error"),
    userId: uuid("user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("genlogs_ws_created_idx").on(t.workspaceId, t.createdAt),
    index("genlogs_client_idx").on(t.clientId),
  ],
);

/** Status-change audit per document (who moved what, when). */
export const statusEvents = pgTable(
  "status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    planItemId: uuid("plan_item_id").references(() => planItems.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    userId: uuid("user_id").references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("status_events_doc_idx").on(t.documentId)],
);

/* keep drizzle happy about unused import when tree-shaken */
export const _sqlRef = sql;
