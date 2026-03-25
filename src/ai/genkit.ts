import {genkit} from 'genkit';
import {mistral} from 'genkitx-mistral';

export const ai = genkit({
  plugins: [mistral()],
  model: 'mistral-large-latest',
});
