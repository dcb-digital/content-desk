/**
 * Per-model token rates for cost estimation.
 *
 * Every generation path used to hardcode Sonnet's $3/$15, so a workspace running
 * Opus was under-reporting its spend by nearly half. Rates belong in one table,
 * keyed by model.
 *
 * Iron rule #2 applies to our own numbers too: a model with no published rate
 * here returns null rather than a plausible-looking figure. The usage screen
 * shows those rows as unpriced and leaves them out of the total, which is the
 * honest answer — a silently wrong dollar figure is worse than a visible gap.
 *
 * Adding a model: put its published rate in the table below. Nothing else needs
 * to change.
 */

/** USD per million tokens. Anthropic list prices, checked 2026-08-05. */
type Rate = { input: number; output: number };

const RATES: Record<string, Rate> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-mythos-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  // Sonnet 5 has a lower introductory rate ($2/$10) until 2026-08-31. Listing
  // the standard rate keeps the estimate from jumping the day it lapses.
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/**
 * Model IDs arrive in three shapes: bare (`claude-opus-4-6`), OpenRouter's
 * vendor-prefixed form (`anthropic/claude-opus-4-6`), and dated snapshots
 * (`claude-haiku-4-5-20251001`). All three should price the same.
 */
export function normaliseModelId(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/^[^/]+\//, "")
    .replace(/-\d{8}$/, "");
}

export type CostEstimate = {
  /** USD, or null when we have no published rate for this model. */
  usd: number | null;
  /** The rate table key that matched, for display and debugging. */
  matchedModel: string | null;
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): CostEstimate {
  const key = normaliseModelId(model);
  const rate = RATES[key];
  if (!rate) return { usd: null, matchedModel: null };

  return {
    usd: (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output,
    matchedModel: key,
  };
}

/** True when we can price this model — used to explain gaps in the usage screen. */
export function isPricedModel(model: string): boolean {
  return normaliseModelId(model) in RATES;
}
