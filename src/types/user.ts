
export interface User {
  uid: string; // Firebase User ID
  email: string | null;
  displayName: string | null;
  isApproved?: boolean; // New field for approval status
  roles?: string[]; // Optional: for future role-based access
  // Add any other Firebase user properties you might need
}
