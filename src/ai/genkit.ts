import {genkit} from 'genkit';
import {disableGenkitOTelInitialization} from 'genkit/tracing';
import {mistral} from 'genkitx-mistral';

// Genkit 1.39 auto-initializes OpenTelemetry on first generation, which crashes
// (addSpanProcessor is not a function) because package.json overrides force
// @opentelemetry/sdk-trace-node 2.x onto @genkit-ai/core's sdk-node 0.52 stack.
// This app is self-hosted and sends no telemetry, so disable OTel init entirely.
disableGenkitOTelInitialization();

export const ai = genkit({
  plugins: [mistral()],
  model: 'mistral/mistral-medium',
});
