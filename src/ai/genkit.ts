import {genkit} from 'genkit';
import {disableGenkitOTelInitialization} from 'genkit/tracing';
import {openAICompatible} from '@genkit-ai/compat-oai';

// Genkit 1.39 auto-initializes OpenTelemetry on first generation, which crashes
// (addSpanProcessor is not a function) because package.json overrides force
// @opentelemetry/sdk-trace-node 2.x onto @genkit-ai/core's sdk-node 0.52 stack.
// This app is self-hosted and sends no telemetry, so disable OTel init entirely.
disableGenkitOTelInitialization();

// All AI configuration comes from environment variables, making the provider
// fully swappable without code changes:
//
//   OPENAI_API_KEY       — Required. API key for the provider.
//   OPENAI_BASE_URL      — Optional. Omit for OpenAI; set for OpenRouter, Ollama,
//                          Together, Groq, or any OpenAI-compatible endpoint.
//   OPENAI_MODEL         — Default model for text parsing (default: gpt-4o).
//   OPENAI_VISION_MODEL  — Model for image/OCR (default: same as OPENAI_MODEL).
//
// Examples:
//   OpenAI:       OPENAI_API_KEY=sk-...  (OPENAI_BASE_URL omitted)
//   OpenRouter:   OPENAI_API_KEY=sk-or-...  OPENAI_BASE_URL=https://openrouter.ai/api/v1
//   Ollama:       OPENAI_API_KEY=ollama  OPENAI_BASE_URL=http://localhost:11434/v1  OPENAI_MODEL=llama3.2
const PLUGIN_NAME = 'oppskrift';
const defaultModel = process.env.OPENAI_MODEL || 'gpt-4o';

export const ai = genkit({
  plugins: [
    openAICompatible({
      name: PLUGIN_NAME,
      apiKey: process.env.OPENAI_API_KEY || 'placeholder',
      ...(process.env.OPENAI_BASE_URL ? {baseURL: process.env.OPENAI_BASE_URL} : {}),
    }),
  ],
  model: `${PLUGIN_NAME}/${defaultModel}`,
});

/** Model reference for text-based recipe parsing. */
export const textModel = `${PLUGIN_NAME}/${defaultModel}`;

/** Model reference for vision (OCR + image parsing). Falls back to textModel. */
export const visionModel = `${PLUGIN_NAME}/${process.env.OPENAI_VISION_MODEL || defaultModel}`;
