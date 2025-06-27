
export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  isApproved?: boolean; // New field for approval status
  roles?: string[]; // Optional: for future role-based access
  
}
