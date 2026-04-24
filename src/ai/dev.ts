
import { config } from 'dotenv';
config({ path: ['.env', '.env.local'] });

import '@/ai/flows/suggest-recipe-image.ts';
import '@/ai/flows/parse-recipe-from-text-flow.ts';
import '@/ai/flows/ocr-and-parse-recipe-flow.ts'; // Add the new flow
    

    