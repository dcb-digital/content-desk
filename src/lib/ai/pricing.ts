/**
 * Token pricing. Server-only — never import this into a client component.
 *
 * Three problems have to be solved separately, because one mechanism can't
 * cover all of them accurately:
 *
 * 1. OpenRouter is a free-text field — the operator can type any of ~340 model
 *    IDs, and the list changes weekly. No hardcoded table can be correct for
 *    that, so rates come from OpenRouter's public models endpoint, which
 *    publishes exact per-token prices. Cached in-process, refreshed hourly.
 * 2. Anthropic and OpenAI direct have no pricing API, so they use the table
 *    below, transcribed from the official pricing pages on the date in
 *    RATES_VERIFIED_ON. Every model either provider's picker offers is covered.
 * 3. A model we genuinely have no rate for returns null, not a guess (iron rule
 *    #2). The usage screen renders those as "not priced" rather than $0.
 *
 * Keeping it accurate: re-check the two pricing pages when RATES_VERIFIED_ON
 * gets stale and bump the date. OpenRouter needs no maintenance.
 */

/** Date the static Anthropic/OpenAI rates below were read from official pricing pages. */
export const RATES_VERIFIED_ON = "2026-08-05";

/** USD per million tokens. */
type Rate = {
  input: number;
  output: number;
  /**
   * Promotional rate window. Set when a provider publishes an introductory
   * price with an end date — after it, `then` applies. Without this the
   * estimate is wrong on one side of the date or the other.
   */
  until?: { date: string; then: { input: number; output: number } };
};

/**
 * Anthropic — https://platform.claude.com/docs/en/about-claude/models/overview
 * Dotted aliases are included because OpenRouter spells Anthropic IDs with dots
 * (`claude-opus-4.6`) while the direct API uses dashes; both must price.
 */
const ANTHROPIC_RATES: Record<string, Rate> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-mythos-5": { input: 10, output: 50 },
  "claude-mythos-preview": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4.8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4.7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4.6": { input: 5, output: 25 },
  "claude-opus-4-5": { input: 5, output: 25 },
  "claude-opus-4.5": { input: 5, output: 25 },
  "claude-opus-4-1": { input: 15, output: 75 },
  "claude-opus-4.1": { input: 15, output: 75 },
  // Introductory $2/$10 runs to 2026-08-31, then the standard $3/$15 applies.
  "claude-sonnet-5": {
    input: 2,
    output: 10,
    until: { date: "2026-08-31", then: { input: 3, output: 15 } },
  },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4.6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4.5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-haiku-4.5": { input: 1, output: 5 },
};

/**
 * OpenAI — https://developers.openai.com/api/docs/pricing (standard tier).
 * Dated snapshots are listed separately where they price differently from the
 * alias: `gpt-4o` is $2.50/$10 but `gpt-4o-2024-05-13` is $5/$15.
 */
const OPENAI_RATES: Record<string, Rate> = {
  "gpt-5.6-sol": { input: 5, output: 30 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.5": { input: 5, output: 30 },
  "gpt-5.5-pro": { input: 30, output: 180 },
  "gpt-5.4": { input: 2.5, output: 15 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-5.4-pro": { input: 30, output: 180 },
  "gpt-5.2": { input: 1.75, output: 14 },
  "gpt-5.2-pro": { input: 21, output: 168 },
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-5-pro": { input: 15, output: 120 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-2024-05-13": { input: 5, output: 15 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  o1: { input: 15, output: 60 },
  "o1-pro": { input: 150, output: 600 },
  o3: { input: 2, output: 8 },
  "o3-pro": { input: 20, output: 80 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4-turbo-2024-04-09": { input: 10, output: 30 },
  "gpt-4-0613": { input: 30, output: 60 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
};

const STATIC_RATES: Record<string, Rate> = { ...ANTHROPIC_RATES, ...OPENAI_RATES };

/**
 * Strips an OpenRouter-style `vendor/` prefix and an 8-digit date suffix
 * (`claude-haiku-4-5-20251001`). Deliberately does NOT strip OpenAI's
 * hyphenated `-2024-05-13` form — those snapshots price differently from the
 * alias, so they're listed explicitly instead.
 */
export function normaliseModelId(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/^[^/]+\//, "")
    .replace(/-\d{8}$/, "");
}

function resolveRate(rate: Rate, on: Date): { input: number; output: number } {
  if (rate.until && on > new Date(`${rate.until.date}T23:59:59Z`)) return rate.until.then;
  return { input: rate.input, output: rate.output };
}

/* --------------------------- OpenRouter (live) --------------------------- */

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENROUTER_TTL_MS = 60 * 60 * 1000;

type OpenRouterModel = { id: string; pricing?: { prompt?: string; completion?: string } };

let openRouterCache: { at: number; rates: Map<string, Rate> } | null = null;
let openRouterInFlight: Promise<Map<string, Rate>> | null = null;

/**
 * OpenRouter publishes per-token prices for every model it serves. Prices are
 * strings in USD per single token, so they're scaled to per-million here.
 * A failed fetch resolves to an empty map — callers fall back to the static
 * table. Pricing must never be the reason a generation fails.
 */
async function fetchOpenRouterRates(): Promise<Map<string, Rate>> {
  const now = Date.now();
  if (openRouterCache && now - openRouterCache.at < OPENROUTER_TTL_MS) {
    return openRouterCache.rates;
  }
  if (openRouterInFlight) return openRouterInFlight;

  openRouterInFlight = (async () => {
    const rates = new Map<string, Rate>();
    try {
      const res = await fetch(OPENROUTER_MODELS_URL, {
        signal: AbortSignal.timeout(8000),
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: OpenRouterModel[] };
      for (const m of body.data ?? []) {
        const input = Number(m.pricing?.prompt);
        const output = Number(m.pricing?.completion);
        if (!m.id || !Number.isFinite(input) || !Number.isFinite(output)) continue;
        rates.set(m.id.toLowerCase(), { input: input * 1_000_000, output: output * 1_000_000 });
      }
      openRouterCache = { at: Date.now(), rates };
    } catch {
      // Keep any previous good cache rather than blanking it on one bad fetch.
      if (openRouterCache) return openRouterCache.rates;
    } finally {
      openRouterInFlight = null;
    }
    return rates;
  })();

  return openRouterInFlight;
}

/* ------------------------------ Public API ------------------------------ */

export type CostEstimate = {
  /** USD, or null when no rate could be established for this model. */
  usd: number | null;
  /** Where the rate came from — useful when a figure looks wrong. */
  source: "openrouter-live" | "table" | null;
  /** The key that matched. */
  matchedModel: string | null;
};

export async function estimateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  now: Date = new Date(),
): Promise<CostEstimate> {
  const price = (rate: Rate, matchedModel: string, source: CostEstimate["source"]): CostEstimate => {
    const { input, output } = resolveRate(rate, now);
    return {
      usd: (inputTokens / 1_000_000) * input + (outputTokens / 1_000_000) * output,
      source,
      matchedModel,
    };
  };

  // OpenRouter bills its own rates, which differ from the underlying provider's
  // list price — only the live figure is correct for it.
  if (provider === "openrouter") {
    const live = await fetchOpenRouterRates();
    const exact = live.get(model.trim().toLowerCase());
    if (exact) return price(exact, model.trim().toLowerCase(), "openrouter-live");
  }

  const key = normaliseModelId(model);
  const rate = STATIC_RATES[key];
  if (rate) return price(rate, key, "table");

  return { usd: null, source: null, matchedModel: null };
}

/** Synchronous table check — for tests and for explaining gaps in the UI. */
export function isPricedInTable(model: string): boolean {
  return normaliseModelId(model) in STATIC_RATES;
}
