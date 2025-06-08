
import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-recipe-image.ts';
import '@/ai/flows/parse-recipe-from-text-flow.ts';
import '@/ai/flows/ocr-and-parse-recipe-flow.ts'; // Add the new flow
    

    