
"use client";

import type { User as FirebaseUserType } from "firebase/auth"; // Firebase's User type
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as firebaseUpdateProfile,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import type { User } from "@/types"; // Your app's User type
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { auth as firebaseAuth } from "@/firebase"; // Your Firebase initialized auth
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n"; // For translating error messages

// Firebase auth error codes: https://firebase.google.com/docs/auth/admin/errors

interface UpdateUserOptions {
  displayName?: string;
  email?: string;
  newPassword?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean; // New admin flag
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  logIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: UpdateUserOptions, currentPassword?: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  sendUserPasswordResetEmail: (email: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapFirebaseUserToAppUser = (firebaseUser: FirebaseUserType | null): User | null => {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false); // Admin state
  const { t } = useTranslation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      const appUser = mapFirebaseUserToAppUser(firebaseUser);
      setUser(appUser);
      // Check if the current user is an admin
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_USER_EMAIL;
      if (appUser && adminEmail && appUser.email === adminEmail) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (userCredential.user && displayName) {
        await firebaseUpdateProfile(userCredential.user, { displayName });
         setUser(mapFirebaseUserToAppUser(firebaseAuth.currentUser));
      }
      setLoading(false);
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase SignUp Error:", error);
      return { success: false, error: t(`firebase_auth_errors.${error.code}`, t('error_generic_title')), errorCode: error.code };
    }
  };

  const logIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      setLoading(false);
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase LogIn Error:", error);
      return { success: false, error: t(`firebase_auth_errors.${error.code}`, t('error_generic_title')), errorCode: error.code };
    }
  };

  const logOut = async (): Promise<void> => {
    setLoading(true);
    try {
      await signOut(firebaseAuth);
      setIsAdmin(false); // Reset admin status on logout
    } catch (error: any) {
      console.error("Firebase LogOut Error:", error);
      toast({ title: t("error_generic_title"), description: t(`firebase_auth_errors.${error.code}`, t('error_generic_title')), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = async (updates: UpdateUserOptions, currentPassword?: string): Promise<{ success: boolean; error?: string, errorCode?: string }> => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return { success: false, error: t("firebase_auth_errors.auth/user-not-found", "User not logged in"), errorCode: "auth/user-not-found" };

    setLoading(true);
    try {
      if ((updates.email || updates.newPassword) && currentPassword) {
        const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
      } else if ((updates.email || updates.newPassword) && !currentPassword) {
        setLoading(false);
        return { success: false, error: t("current_password_required_for_change"), errorCode: "auth/missing-password" };
      }

      if (updates.displayName !== undefined && updates.displayName !== currentUser.displayName) {
        await firebaseUpdateProfile(currentUser, { displayName: updates.displayName });
      }
      if (updates.email && updates.email !== currentUser.email) {
        await firebaseUpdateEmail(currentUser, updates.email);
      }
      if (updates.newPassword) {
        await firebaseUpdatePassword(currentUser, updates.newPassword);
      }
      
      setUser(mapFirebaseUserToAppUser(firebaseAuth.currentUser));
      // Re-check admin status if email might have changed, though admin email is usually static
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_USER_EMAIL;
      if (firebaseAuth.currentUser && adminEmail && firebaseAuth.currentUser.email === adminEmail) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
      return { success: true };

    } catch (error: any) {
      setLoading(false);
      console.error("Firebase Update Profile Error:", error);
      return { success: false, error: t(`firebase_auth_errors.${error.code}`, t('error_updating_profile')), errorCode: error.code };
    }
  };
  
  const sendUserPasswordResetEmail = async (email: string): Promise<{ success: boolean; error?: string, errorCode?: string }> => {
    setLoading(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setLoading(false);
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase Send Password Reset Email Error:", error);
      return { success: false, error: t(`firebase_auth_errors.${error.code}`, t('error_sending_email')), errorCode: error.code };
    }
  };


  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signUp, logIn, logOut, updateUserProfile, sendUserPasswordResetEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
