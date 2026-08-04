/**
 * Resolves a Vercel AI SDK LanguageModel from workspace settings.
 * Decrypts the API key at call time — never cached, never logged.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { decrypt } from "@/lib/crypto";

type ProviderConfig = { encKey: string; model: string };

export async function getModel(
  providers: Record<string, ProviderConfig>,
  defaultProvider: string,
): Promise<{ model: LanguageModel; provider: string; modelId: string }> {
  const providerName = defaultProvider ?? "anthropic";
  const config = providers[providerName];

  if (!config) {
    throw new Error(
      `No API key configured for provider "${providerName}". Add one in Settings.`,
    );
  }

  const apiKey = await decrypt(config.encKey);
  const modelId = config.model;

  if (providerName === "anthropic") {
    const p = createAnthropic({ apiKey });
    return { model: p(modelId), provider: providerName, modelId };
  }

  if (providerName === "openai") {
    const p = createOpenAI({ apiKey });
    return { model: p(modelId) as unknown as LanguageModel, provider: providerName, modelId };
  }

  if (providerName === "openrouter") {
    const p = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": process.env.APP_URL ?? "https://content-desk.app",
        "X-Title": "Content Desk",
      },
    });
    return { model: p(modelId) as unknown as LanguageModel, provider: providerName, modelId };
  }

  throw new Error(`Unknown provider: ${providerName}`);
}
