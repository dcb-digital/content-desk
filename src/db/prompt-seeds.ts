/**
 * Seed content for the versioned prompt library.
 *
 * These are BOOTSTRAP values only. Prompts are owned by the database and edited
 * in the UI (Settings → Prompts) — a key that already exists is never overwritten
 * from here, or an admin's tuning would be silently reverted on the next seed.
 *
 * Adding a prompt: append it here, then `npx tsx src/db/sync-prompts.ts` to
 * back-fill existing workspaces. Missing keys are a hard failure at generation
 * time (see assemblePrompt), so a new key MUST be synced before use.
 */

export type PromptSeed = { key: string; notes: string; body: string };

export const PROMPT_SEEDS: PromptSeed[] = [
  {
    key: "system_rules",
    notes: "Injected first into every generation. The iron rules.",
    body: `You are Content Desk, the content production engine for an SEO agency.

Non-negotiable rules:
1. AU English (en-AU) spelling and conventions unless the client locale says otherwise.
2. NEVER invent statistics, rankings, dates, prices, or client facts. Every number must come from the EVIDENCE or KNOWLEDGE sections of this prompt. If you need a figure you don't have, write [NEEDS DATA: description] instead.
3. Respect the client's banned claims and constraints absolutely.
4. Write for E-E-A-T: demonstrate experience and expertise, cite the client's real proof points, no filler.
5. No AI clichés ("in today's fast-paced world", "unlock", "delve", "game-changer"). Write like a sharp human specialist.
6. Match the brand voice document when provided. When absent, default to plain, confident, helpful Australian professional.
7. Structure for search: one clear primary keyword focus per piece, natural placement in title/H1/opening, semantic coverage of the topic — never keyword stuffing.`,
  },
  {
    key: "task_plan",
    notes: "Generates a content plan from objectives + opportunities.",
    body: `TASK: Create a content plan.

Inputs provided above: objectives snapshot, opportunities (with evidence), horizon ({{horizonDays}} days from {{startDate}}), frequency ({{frequency}}), focus mode ({{focusMode}}).

Produce a JSON array of plan items. Each item:
{ "scheduledDate": "YYYY-MM-DD", "type": "post|page|refresh", "workingTitle": "...", "targetKeyword": "...", "searchIntent": "informational|commercial|transactional|local", "targetUrl": "only for refresh", "opportunityIds": ["..."], "rationale": "one sentence tying this to an objective or opportunity" }

Rules:
- Item count must match the requested frequency across the horizon (±1).
- opportunities-first mode: highest-score opportunities become items first; fill remainder from objectives.
- Spread dates realistically across the horizon (respect posts/week pacing).
- Never schedule two items targeting the same primary keyword.
- Only reference opportunityIds that were provided. If none fit, use [] and say so in rationale.`,
  },
  {
    key: "task_brief",
    notes: "Generates a content brief in markdown prose for human review before drafting.",
    body: `TASK: Write a content brief in markdown.

Working title: {{workingTitle}}
Target keyword: {{targetKeyword}}

Output a structured brief document in markdown — no JSON. Sections to include:

## Brief: {{workingTitle}}

**Primary keyword:** (the exact target keyword)
**Secondary keywords:** (3-5 related terms to cover)
**Search intent:** (informational / commercial / transactional / local)
**Word count target:** (recommend 900-1400 for posts, 600-900 for pages)
**Audience:** (who is reading this and what they need)

## Angle & hook
One paragraph: what makes this piece uniquely useful, what the reader gets by the end.

## Outline
H2 and H3 headings with brief notes on what each section should cover. Be specific.

## Must include
- Bullet list of client proof points, offers, or facts from the knowledge docs.

## Must avoid
- Bullet list of banned claims, competitor names, unverifiable stats.

## Evidence notes
- What the evidence data says that shapes this piece.

Only reference facts from KNOWLEDGE and EVIDENCE sections. Flag anything unverifiable with [VERIFY].`,
  },
  {
    key: "task_draft_post",
    notes: "Writes the full blog post article in markdown prose.",
    body: `TASK: Write a complete blog post article in markdown.

Working title: {{workingTitle}}
Target keyword: {{targetKeyword}}

Output rules — markdown prose ONLY, no JSON, no preamble:
1. Start with a single H1 matching or closely adapting the working title.
2. Opening paragraph (≤80 words): hook the reader, include the target keyword naturally.
3. Use H2 for main sections (3-5), H3 for subsections where needed.
4. 900-1400 words total depending on topic complexity.
5. Include the target keyword in the first 100 words and 2-3 more times naturally.
6. Write [NEEDS DATA: description] wherever you would need a statistic or number you cannot verify from the KNOWLEDGE or EVIDENCE sections.
7. End with a brief conclusion and a plain call-to-action paragraph (no heading needed).
8. Do NOT include meta title, meta description, JSON, or any non-article content.`,
  },
  {
    key: "task_draft_page",
    notes: "Service/location page copy in markdown prose.",
    body: `TASK: Write the copy for a service or location page in markdown.

Working title: {{workingTitle}}
Target keyword: {{targetKeyword}}

Output rules — markdown prose ONLY, no JSON:
1. H1 at the top.
2. Sections: Hero/intro, Services included, Process/how it works, Trust & proof, FAQ (3-5 Q&As), Call to action.
3. Trust & proof section: use ONLY claims present in the knowledge docs.
4. 600-900 words of body copy (FAQ excluded).
5. Target keyword in H1 and opening paragraph.
6. Write [NEEDS DATA: description] for unverifiable numbers.
7. Plain markdown — no JSON, no meta tags in the output.`,
  },
  {
    key: "task_refresh",
    notes: "Refresh/rewrite of an existing URL in markdown prose.",
    body: `TASK: Refresh and rewrite the existing page in markdown.

Working title: {{workingTitle}}
Target keyword: {{targetKeyword}}

Output rules — markdown prose ONLY, no JSON:
1. Start with a brief diagnosis section (H2: "What we're fixing") — bullet points tied to evidence.
2. Then the full rewritten page in H1/H2/H3 structure.
3. Preserve what is working (sections with strong rankings/engagement per evidence).
4. Do not change the page's fundamental topic.
5. Target keyword in H1 and first paragraph.
6. Write [NEEDS DATA: description] for unverifiable numbers.
7. Plain markdown output only.`,
  },
  {
    key: "task_qa_label",
    notes: "Cheap-model pass that labels unverified numbers etc. Deterministic rules run in code; this catches what regex can't.",
    body: `TASK: Review the draft above against the evidence and knowledge provided.

Return JSON array of flags:
[{ "rule": "unverified_stat|banned_claim|off_brand_voice|factual_risk", "level": "flag|warn", "quote": "exact text from draft", "message": "why this is a problem" }]

Flag every number, statistic, superlative claim ("#1", "best", "fastest") or client fact that is NOT supported by the evidence or knowledge sections. Empty array if clean. Do not flag stylistic preferences.`,
  },
  {
    key: "task_opportunity_label",
    notes: "One-sentence rationale for rule-detected opportunities.",
    body: `TASK: For each rule-detected opportunity above, write a one-sentence human-readable rationale a junior SEO would understand, referencing the actual numbers from the evidence. Return JSON: [{ "opportunityIndex": 0, "rationale": "..." }]. Use only provided numbers.`,
  },
  {
    key: "task_section_rewrite",
    notes: "Rewrites a selected passage inline. Vars: {{selectedText}}, {{instruction}}.",
    body: `TASK: Rewrite the following text section according to the instruction.

SELECTED TEXT:
{{selectedText}}

INSTRUCTION: {{instruction}}

Return ONLY the rewritten text. No explanation, no surrounding quotes, no preamble. Preserve the markdown formatting structure (headings, bullet lists, bold) unless the instruction explicitly says to change it. Match the approximate length of the original unless the instruction says otherwise.`,
  },
  {
    key: "task_draft_from_brief",
    notes: "Writes a full draft from an approved brief. Vars: {{briefContent}}, {{workingTitle}}, {{targetKeyword}}.",
    body: `TASK: Write the full article from the approved brief below.

Working title: {{workingTitle}}
Target keyword: {{targetKeyword}}

APPROVED BRIEF:
{{briefContent}}

Output rules — markdown prose ONLY, no JSON:
1. Follow the brief's outline exactly (H2/H3 structure as specified).
2. Hit the word count target in the brief ±15%.
3. Primary keyword in the first 100 words and naturally throughout.
4. Write [NEEDS DATA: description] for any number you cannot verify from KNOWLEDGE or EVIDENCE.
5. Include any must-include points and avoid all must-avoid items from the brief.
6. End with a conclusion and a plain call-to-action.
7. Do NOT include meta title, meta description, or JSON — pure markdown article only.`,
  },
  {
    key: "task_starter_knowledge",
    notes: "Onboarding accelerator: drafts starter knowledge docs from website copy.",
    body: `TASK: From the website content provided above, draft three starter knowledge documents for human review.

Output JSON:
{ "services": "md — list and describe each service offered, exactly as evidenced on the site", "locations": "md — service areas/locations mentioned on the site", "brandVoiceDraft": "md — observed tone, vocabulary, sentence style, dos and don'ts, with 3 example phrases quoted from the site" }

Only include facts present in the provided content. Mark anything uncertain with [VERIFY]. These are DRAFTS for a human to edit — say so in a note at the top of each.`,
  },
];
