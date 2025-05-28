
// This file is no longer needed for Firebase password reset flow as it's handled client-side.
// You can delete this file.
// If you have other server actions, keep them, but the password reset logic
// has been moved to the client using Firebase's client SDK.

'use server';

// // Old nodemailer and token logic has been removed.
// // Firebase handles password reset emails and token verification.

// export async function requestPasswordReset(formData: FormData): Promise<{ success: boolean; messageKey?: string; errorKey?: string, error?: string }> {
//   // This logic is now in src/app/forgot-password/page.tsx using Firebase client SDK
//   return { success: false, errorKey: 'functionality_moved_to_client' };
// }

// export async function verifyPasswordResetToken(token: string): Promise<{ success: boolean; email?: string; errorKey?: string }> {
//   // This logic is now in src/app/reset-password/page.tsx using Firebase client SDK
//   return { success: false, errorKey: 'functionality_moved_to_client' };
// }

// export async function consumePasswordResetToken(token: string): Promise<{ success: boolean; email?: string; errorKey?: string }> {
//   // This logic is now in src/app/reset-password/page.tsx using Firebase client SDK
//  return { success: false, errorKey: 'functionality_moved_to_client' };
// }
