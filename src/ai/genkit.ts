import {genkit} from 'genkit';
import {mistralAI} from '@genkit-ai/mistral';

export const ai = genkit({
  plugins: [mistralAI()],
  model: 'mistral-large-latest',
});
