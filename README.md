
# Oppskrift - Your Personal Recipe Book

Oppskrift is a modern, web-based application designed to help you manage your personal recipe collection with ease. Built with Next.js and Firebase, it offers a streamlined experience for creating, viewing, editing, and organizing your favorite recipes.

## Key Features

*   **Recipe Management:** Add, view, edit, and delete your personal recipes. Recipes can be marked as public (visible to all users) or private (visible only to the creator).
*   **Rich Recipe Details:** Store ingredients, multi-step instructions, serving sizes, prep/cook times, categories, and tags.
*   **AI-Powered Image Suggestions:** Get relevant image suggestions for your recipes based on their titles, powered by Genkit and Gemini. Images are stored as data URIs after client-side resizing.
*   **Dynamic Ingredient Scaling:** Adjust serving sizes on the fly, and ingredient quantities will scale automatically.
*   **Shopping List:** Add ingredients from recipes to a consolidated shopping list.
*   **Filtering & Searching:** Easily find recipes by searching titles or by clicking on categories and tags.
*   **User Authentication:** Secure user accounts powered by Firebase Authentication (email/password). Includes profile editing (name, email, password) and a password reset flow handled by Firebase.
*   **Persistent Storage:** Recipe data is stored securely in Firebase Firestore.
*   **Import/Export:** Users can export their recipes to a JSON file and import recipes from a JSON file.
*   **Internationalization (i18n):** Supports multiple languages (English, Norwegian, Spanish).
*   **Responsive Design:** Built with ShadCN UI components and Tailwind CSS for a clean experience on all devices.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **Styling:** Tailwind CSS, ShadCN UI
*   **Backend & Database:** Firebase (Authentication, Firestore)
*   **AI Integration:** Genkit (using Google Gemini models)
*   **Internationalization:** `i18next` pattern with JSON locale files
*   **Drag & Drop:** `@hello-pangea/dnd` for reordering ingredients.

## Getting Started

To explore the app, take a look at the main page component located at `src/app/page.tsx`.

Ensure your Firebase project is configured with Authentication (Email/Password provider enabled), Firestore, and the necessary API keys are set up in your `.env.local` file.
```
# Firebase Configuration (Required)
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET" # Required by Firebase SDK, even if not actively used for recipe images.
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

# For Genkit/AI features (using Gemini - Required if using AI image suggestions)
GOOGLE_API_KEY="YOUR_GOOGLE_AI_STUDIO_API_KEY"

# For determining the base URL for links in password reset emails (Required for password reset)
NEXT_PUBLIC_APP_URL=http://localhost:9002 # Or your deployment URL
```

This project was initialized and developed in Firebase Studio.

