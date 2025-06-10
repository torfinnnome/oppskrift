
# Oppskrift - Your Personal Recipe Book

Oppskrift is a modern, web-based application designed to help you manage your personal recipe collection with ease. Built with Next.js and Firebase, it offers a streamlined experience for creating, viewing, editing, and organizing your favorite recipes.

## Screenshot

![Oppskrift application showing a list of recipes including "Middels grove rundstykker" and "Middels grovt brød", with search and filter options visible.](./docs/screenshot.png)
*The main recipe listing page in Oppskrift, displaying user's recipes with search and filtering capabilities.*

## Key Features

*   **Recipe Management:** Add, view, edit, and delete your personal recipes. Recipes can be marked as public (visible to all users, even unauthenticated) or private (visible only to the creator).
*   **Rich Recipe Details:** Store ingredients, multi-step instructions, serving sizes, prep/cook times, categories, and tags.
*   **AI-Powered Recipe Import (Text/URL):** Paste raw recipe text or a URL into the recipe form, and an AI agent (powered by Genkit) will attempt to parse the content and automatically populate the form fields. The AI uses the currently selected UI language as a guide for parsing.
*   **AI-Powered Recipe Import (Image OCR):** Upload an image of a recipe (or drag-and-drop), and the AI will perform Optical Character Recognition (OCR) to extract text, then parse that text to populate the recipe form. This feature also uses the selected UI language to guide the AI.
*   **AI-Powered Image Suggestions:** Get relevant image suggestions for your recipes based on their titles, powered by Genkit and Gemini. Images are stored as data URIs after client-side resizing. (Note: Image generation availability may be subject to regional restrictions by the model provider, as is currently the case for Norway/EU with `gemini-2.0-flash-exp`).
*   **Star Rating System:** Users can rate public recipes (and owners their own private recipes) on a 1-5 star scale. Average ratings and vote counts are displayed. Users can also clear their vote.
*   **Dynamic Ingredient Scaling:** Adjust serving sizes on the fly, and ingredient quantities will scale automatically.
*   **Shopping List:** Add ingredients from recipes to a consolidated shopping list.
*   **Filtering & Searching:** Easily find recipes by searching titles, descriptions, ingredients, categories, or tags. Filter by visibility (public, private, community).
*   **User Authentication:** Secure user accounts powered by Firebase Authentication (email/password). Includes profile editing (name, email, password) and a password reset flow handled by Firebase.
*   **User Approval System:** New users require admin approval before they can create recipes or rate others' public recipes.
*   **Persistent Storage:** Recipe data is stored securely in Firebase Firestore.
*   **Import/Export:** Users can export their recipes to a JSON file and import recipes from a JSON file. HTML and Markdown export for individual and all user recipes.
*   **Internationalization (i18n):** Supports multiple languages (English, Norwegian, Spanish).
*   **Responsive Design:** Built with ShadCN UI components and Tailwind CSS for a clean experience on all devices.
*   **Admin Functionality:** A designated admin user (defined by email in `.env.local` and UID in Firestore rules) can delete any recipe in the system and approve new users.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **Styling:** Tailwind CSS, ShadCN UI
*   **Backend & Database:** Firebase (Authentication, Firestore)
*   **AI Integration:** Genkit (using Google Gemini models)
*   **Internationalization:** `i18next` pattern with JSON locale files (adapted for a simpler context-based approach).
*   **Drag & Drop:** `@hello-pangea/dnd` for reordering ingredients and steps.

## Getting Started

To explore the app, take a look at the main page component located at `src/app/page.tsx`.

### Firebase Setup

Ensure your Firebase project is configured with:
1.  **Authentication:** Email/Password provider enabled.
2.  **Firestore:** Database created (choose a region).
3.  **API Keys:** Your web app's Firebase configuration keys.

### Environment Variables

Create a `.env.local` file in the root of your project and add the following variables:

```env
# Firebase Configuration (Required)
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET" # Required by Firebase SDK
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

# For Genkit/AI features (using Gemini - if AI image suggestions are used and available)
# GOOGLE_API_KEY="YOUR_GOOGLE_AI_STUDIO_API_KEY" # Currently image generation via Gemini is restricted in some regions.

# For determining the base URL for links in password reset emails (Required for password reset)
NEXT_PUBLIC_APP_URL=http://localhost:9002 # Or your deployment URL

# Admin User Configuration (Optional - for admin features)
# Set the email of the user who should have admin privileges.
# This is used by the client-side to determine if admin UI should be shown.
# Actual admin privileges are enforced by Firestore rules using the admin's UID.
NEXT_PUBLIC_ADMIN_USER_EMAIL="your_admin_email@example.com"
```
**Restart your development server after creating or modifying the `.env.local` file.**

### Firestore Security Rules

For proper data protection and admin functionality, update your Firestore security rules. Go to your Firebase project -> Firestore Database -> Rules tab, and use the following:

```json
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Function to check if the requesting user is the defined admin by UID
    function isAdmin() {
      // IMPORTANT: Replace "YOUR_ADMIN_USER_UID_HERE" with the actual
      // UID of your admin user from the Firebase Authentication console.
      // You can find this UID in the Firebase console under Authentication -> Users.
      return request.auth.uid == "YOUR_ADMIN_USER_UID_HERE";
    }

    // Function to check if a user is approved
    function isUserApproved(userId) {
      return exists(/databases/$(database)/documents/users/$(userId)) &&
             get(/databases/$(database)/documents/users/$(userId)).data.isApproved == true;
    }

    match /users/{userId} {
      // User can read their own data, admin can read any user's data
      allow read: if request.auth.uid == userId || isAdmin();
      
      // User can create their own document on signup
      allow create: if request.auth.uid == userId &&
                      request.resource.data.uid == request.auth.uid &&
                      request.resource.data.email == request.auth.token.email &&
                      request.resource.data.isApproved == false &&
                      request.resource.data.roles[0] == 'user' &&
                      // Assuming client sends createdAt as a string (ISO date) or server timestamp
                      (request.resource.data.createdAt is string || request.resource.data.createdAt is timestamp); 
      
      // Admin can update specific fields like isApproved, roles, and updatedAt
      // User can update their own displayName, email (if also providing password - handled client side), updatedAt
      allow update: if (isAdmin() &&
                       request.resource.data.diff(resource.data).affectedKeys().hasAny(['isApproved', 'roles', 'updatedAt']) &&
                       (request.resource.data.updatedAt is string || request.resource.data.updatedAt == null || request.resource.data.updatedAt is timestamp)
                      ) ||
                      (request.auth.uid == userId &&
                       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'email', 'updatedAt']) &&
                       (request.resource.data.updatedAt is string || request.resource.data.updatedAt == null || request.resource.data.updatedAt is timestamp)
                      );

      // Admin can delete user documents if needed (optional)
      allow delete: if isAdmin();
    }

    match /recipes/{recipeId} {
      // Public recipes are readable by ANYONE (even unauthenticated users).
      // Authenticated users can also read their own private recipes.
      allow read: if resource.data.isPublic == true || (request.auth != null && resource.data.createdBy == request.auth.uid);
      
      // Users can only create recipes for themselves IF THEY ARE APPROVED.
      // Ensure required fields for new recipes are present.
      allow create: if request.auth != null && 
                      request.resource.data.createdBy == request.auth.uid &&
                      isUserApproved(request.auth.uid) && // CHECK: User must be approved
                      request.resource.data.title is string &&
                      request.resource.data.ingredientGroups is list &&
                      request.resource.data.instructions is list &&
                      request.resource.data.servingsValue is number &&
                      request.resource.data.servingsUnit is string &&
                      (request.resource.data.createdAt is string || request.resource.data.createdAt is timestamp) && 
                      (request.resource.data.updatedAt is string || request.resource.data.updatedAt is timestamp);
      
      // For updates:
      allow update: if request.auth != null &&
                    (
                      // Case 1: Owner updates (includes rating their own recipe)
                      (
                        resource.data.createdBy == request.auth.uid &&
                        // Cannot change createdBy or createdAt
                        !(request.resource.data.diff(resource.data).affectedKeys().hasAny(['createdBy', 'createdAt'])) &&
                        // Ensure updatedAt is an ISO string (matching client behavior) or null
                        (request.resource.data.updatedAt is string || request.resource.data.updatedAt == null || request.resource.data.updatedAt is timestamp) &&
                        (
                          // Approved owner can change anything (except system fields mentioned above)
                          isUserApproved(request.auth.uid) ||
                          // OR Unapproved owner can ONLY change rating-related fields on their own recipe
                          (
                            !isUserApproved(request.auth.uid) &&
                            request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ratings', 'averageRating', 'numRatings', 'updatedAt'])
                          )
                        )
                      ) ||
                      // Case 2: Non-owner (must be approved) rates a public recipe (SIMPLIFIED LOGIC)
                      (
                        resource.data.createdBy != request.auth.uid &&    // Not the owner
                        isUserApproved(request.auth.uid) &&                // Rater must be approved
                        resource.data.isPublic == true &&                  // Recipe must be public
                        // Can only change rating-related fields
                        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ratings', 'averageRating', 'numRatings', 'updatedAt']) &&
                        // Ensure updatedAt is an ISO string or null
                        (request.resource.data.updatedAt is string || request.resource.data.updatedAt == null || request.resource.data.updatedAt is timestamp)
                      )
                    );
      
      // Admin can delete any recipe, or owner can delete their own.
      allow delete: if request.auth != null && (resource.data.createdBy == request.auth.uid || isAdmin());
    }

    match /shoppingLists/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
**Remember to replace `"YOUR_ADMIN_USER_UID_HERE"` in the Firestore rules with the actual Firebase UID of your designated admin user.** You can find the UID in the Firebase console under Authentication -> Users tab.

This project was initialized and developed in Firebase Studio.


    
