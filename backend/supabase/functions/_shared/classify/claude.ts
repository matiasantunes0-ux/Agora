// Claude-backed classifier. Deno-only (npm: import), so tests never load it —
// the parts worth testing (schema, prompt, validation) live in schema.ts / prompt.ts.
//
// OFF BY DEFAULT: it is only used when CLASSIFIER=claude and ANTHROPIC_API_KEY
// are both set (see classify/select.ts), because every call costs money.

import Anthropic from "npm:@anthropic-ai/sdk";
import type { ClassificationOutput, Classifier, ClassifierInput } from "../types.ts";
import { CLASSIFICATION_SCHEMA } from "./schema.ts";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.ts";
import { ClassifierRefusal, ClassifierUnavailable } from "./errors.ts";

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

export function createClaudeClassifier(apiKey: string, model = DEFAULT_CLAUDE_MODEL): Classifier {
  // The SDK already retries 429/5xx with backoff; 3 tries is enough inside a 10-minute cron.
  const client = new Anthropic({ apiKey, maxRetries: 3 });

  return {
    name: `claude:${model}`,
    async classify(input: ClassifierInput): Promise<ClassificationOutput> {
      // Built as a plain object: `fallbacks` and structured `output_config.format`
      // are newer than some SDK typings.
      const params = {
        model,
        max_tokens: 8000,
        // Server-side fallback: if the model declines, the API retries on Anthropic's
        // recommended fallback model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Short classification task: low effort keeps it fast and cheap.
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: CLASSIFICATION_SCHEMA },
        },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildUserMessage(input) }],
      };

      let response;
      try {
        response = await client.beta.messages.create(params as Parameters<typeof client.beta.messages.create>[0]);
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
          throw new ClassifierUnavailable(String(err));
        }
        throw err; // 400/401/404 are bugs or config problems; surface them.
      }

      if (response.stop_reason === "refusal") throw new ClassifierRefusal(`declined: ${response.stop_details?.category ?? "unknown"}`);
      if (response.stop_reason === "max_tokens") throw new ClassifierUnavailable("hit max_tokens");

      const text = response.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new ClassifierUnavailable("no text block in response");
      // Shape is enforced by the API; content is still checked by validateClassification().
      return JSON.parse(text.text) as ClassificationOutput;
    },
  };
}
