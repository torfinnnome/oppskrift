
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
*   **Admin Functionality:** A designated admin user (defined by email) can delete any recipe in the system.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **Styling:** Tailwind CSS, ShadCN UI
*   **Backend & Database:** Firebase (Authentication, Firestore)
*   **AI Integration:** Genkit (using Google Gemini models)
*   **Internationalization:** `i18next` pattern with JSON locale files
*   **Drag & Drop:** `@hello-pangea/dnd` for reordering ingredients.

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
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET" # Required by Firebase SDK, even if not actively used for recipe images.
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

# For Genkit/AI features (using Gemini - Required if using AI image suggestions)
GOOGLE_API_KEY="YOUR_GOOGLE_AI_STUDIO_API_KEY"

# For determining the base URL for links in password reset emails (Required for password reset)
NEXT_PUBLIC_APP_URL=http://localhost:9002 # Or your deployment URL

# Admin User Configuration (Optional - for admin features)
# Set the email of the user who should have admin privileges.
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

    match /recipes/{recipeId} {
      // Authenticated users can read any public recipe OR their own recipes (public or private).
      allow read: if request.auth != null && (resource.data.isPublic == true || resource.data.createdBy == request.auth.uid);
      // Optional: If you want even unauthenticated users to see public recipes, 
      // you would modify the read rule:
      // allow read: if resource.data.isPublic == true || (request.auth != null && resource.data.createdBy == request.auth.uid);

      // Users can only create recipes for themselves.
      allow create: if request.auth != null && request.resource.data.createdBy == request.auth.uid;
      
      // Users can only update their own recipes.
      allow update: if request.auth != null && resource.data.createdBy == request.auth.uid;
      
      // Admin can delete any recipe, or owner can delete their own.
      allow delete: if request.auth != null && (resource.data.createdBy == request.auth.uid || isAdmin());
    }

    // Placeholder for shopping lists - can be refined later
    match /shoppingLists/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
**Remember to replace `"YOUR_ADMIN_USER_UID_HERE"` in the Firestore rules with the actual Firebase UID of your designated admin user.** You can find the UID in the Firebase console under Authentication -> Users tab.

This project was initialized and developed in Firebase Studio.
```