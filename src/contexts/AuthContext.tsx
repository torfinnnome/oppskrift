"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useSession, signOut } from "next-auth/react";
import { User as NextAuthUser } from "next-auth";


import { User as AppUserType } from "@/types"; // Assuming your AppUserType is compatible
import { toast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AppUserType | null;
  loading: boolean;
  logOut: () => Promise<void>;
  updateUserProfile: (
    profileData: Partial<AppUserType>,
    currentPassword?: string
  ) => Promise<{ success: boolean; errorCode?: string }>;
  sendUserPasswordResetEmail: (email: string) => Promise<{ success: boolean; message?: string }>;
  isAdmin: boolean;
  isUserApproved: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, t }: { children: ReactNode; t: (key: string) => string }) {
  const { data: session, status, update } = useSession();
  const [user, setUser] = useState<AppUserType | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserApproved, setIsUserApproved] = useState(false);
  const loading = status === "loading";

  useEffect(() => {
    const fetchUserApprovalStatus = async () => {
      if (session?.user?.email) {
        try {
          const response = await fetch("/api/user/status");
          if (response.ok) {
            const data = await response.json();
            // Map NextAuth user to AppUserType
            const nextAuthUser = session.user as NextAuthUser & { isApproved: boolean; roles: string[]; theme: string; };
            const appUser: AppUserType = {
              id: nextAuthUser.id || "", // Assuming 'id' is available from NextAuth session
              email: nextAuthUser.email || null,
              displayName: nextAuthUser.name || null,
              isApproved: data.isApproved, // Use the fetched status
              roles: nextAuthUser.roles || ["user"], // Custom property
              theme: nextAuthUser.theme || "dark", // Custom property
            };
            setUser(appUser);
            setIsAdmin((appUser.roles || []).includes("admin"));
            setIsUserApproved(!!appUser.isApproved);
          } else {
            console.error("Failed to fetch user approval status");
            setUser(null);
            setIsAdmin(false);
            setIsUserApproved(false);
          }
        } catch (error) {
          console.error("Error fetching user approval status:", error);
          setUser(null);
          setIsAdmin(false);
          setIsUserApproved(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsUserApproved(false);
      }
    };

    fetchUserApprovalStatus();
  }, [session]);

  const logOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const updateUserProfile = async (
    profileData: Partial<AppUserType>,
    currentPassword?: string
  ): Promise<{ success: boolean; errorCode?: string }> => {
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...profileData, currentPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, errorCode: errorData.code || "unknown_error" };
      }

      // Update the session to reflect the new user data
      await update(); // This will refetch the session from the server

      toast({ title: t("profile_updated_successfully") });
      return { success: true };
    } catch (error) {
      console.error("Error updating user profile:", error);
      return { success: false, errorCode: "network_error" };
    }
  };

  const sendUserPasswordResetEmail = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || "Failed to send reset email." };
      }

      return { success: true, message: data.message };
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return { success: false, message: "Network error or server unreachable." };
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, logOut, updateUserProfile, sendUserPasswordResetEmail, isAdmin, isUserApproved }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
