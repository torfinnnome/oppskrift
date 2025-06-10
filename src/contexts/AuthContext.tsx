
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
import { auth as firebaseAuth, db } from "@/firebase"; // Your Firebase initialized auth
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"; // Firestore imports
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";

interface UpdateUserOptions {
  displayName?: string;
  email?: string;
  newPassword?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isUserApproved: boolean; // New flag for user approval status
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  logIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: UpdateUserOptions, currentPassword?: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  sendUserPasswordResetEmail: (email: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapFirebaseUserToAppUser = async (firebaseUser: FirebaseUserType | null): Promise<User | null> => {
  if (!firebaseUser) return null;
  let isApproved = false;
  let roles: string[] = [];

  if (db) {
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      let userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // User exists in Auth but not in Firestore 'users' collection.
        // Create their document now.
        console.log(`User document for ${firebaseUser.uid} not found. Creating now.`);
        const newUserDocData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || "",
          isApproved: false, // Default to not approved
          roles: ['user'],   // Default role
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userDocRef, newUserDocData);
        // Re-fetch the snapshot after creation
        userDocSnap = await getDoc(userDocRef); 
        isApproved = false; // They've just been created, so they are not approved yet
        roles = ['user'];
      } else {
        const userData = userDocSnap.data();
        isApproved = userData.isApproved || false;
        roles = userData.roles || [];
      }
    } catch (error) {
      console.error("Error fetching or creating user document:", error);
      // Keep isApproved as false and roles empty if there's an error
      isApproved = false;
      roles = [];
    }
  }


  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    isApproved,
    roles,
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserApproved, setIsUserApproved] = useState(false); // User approval state
  const { t } = useTranslation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        const appUser = await mapFirebaseUserToAppUser(firebaseUser);
        setUser(appUser);
        setIsUserApproved(appUser?.isApproved || false);

        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_USER_EMAIL;
        if (appUser && adminEmail && appUser.email === adminEmail && appUser.isApproved) { // Admin must also be approved
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsUserApproved(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (userCredential.user) {
        if (displayName) {
          await firebaseUpdateProfile(userCredential.user, { displayName });
        }
        // Create user document in Firestore
        if (db) { 
            const userDocRef = doc(db, "users", userCredential.user.uid);
            await setDoc(userDocRef, {
              uid: userCredential.user.uid,
              email: userCredential.user.email,
              displayName: displayName || userCredential.user.displayName || "",
              isApproved: false, // Default to not approved
              roles: ['user'], // Default role
              createdAt: serverTimestamp(), 
              updatedAt: serverTimestamp(),
            });
        } else {
            console.error("Firestore (db) is not initialized. Cannot create user document.");
        }
        // Update local auth state immediately for responsiveness
        const appUser = await mapFirebaseUserToAppUser(firebaseAuth.currentUser);
        setUser(appUser);
        setIsUserApproved(appUser?.isApproved || false);
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
      // onAuthStateChanged will handle fetching user data and setting approval status,
      // including creating the user document if it's missing.
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
      // State will be cleared by onAuthStateChanged
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
        if (!currentUser.email) {
          console.error("User email is null, cannot re-authenticate for email/password update.");
          setLoading(false);
          return {
            success: false,
            error: t('error_updating_profile_unexpected_email_null'),
            errorCode: "auth/internal-error-email-null"
          };
        }
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
      } else if ((updates.email || updates.newPassword) && !currentPassword) {
        setLoading(false);
        return { success: false, error: t("current_password_required_for_change"), errorCode: "auth/missing-password" };
      }

      const firestoreUpdates: any = {updatedAt: serverTimestamp()};

      if (updates.displayName !== undefined && updates.displayName !== currentUser.displayName) {
        await firebaseUpdateProfile(currentUser, { displayName: updates.displayName });
        firestoreUpdates.displayName = updates.displayName;
      }
      if (updates.email && updates.email !== currentUser.email) {
        if (!currentUser.email && !currentPassword) {
             console.error("User email is null, cannot update email without re-authentication.");
             setLoading(false);
             return {
                success: false,
                error: t('error_updating_profile_unexpected_email_null'),
                errorCode: "auth/internal-error-email-null-update"
             };
        }
        await firebaseUpdateEmail(currentUser, updates.email);
        firestoreUpdates.email = updates.email;
      }
      if (updates.newPassword) {
        await firebaseUpdatePassword(currentUser, updates.newPassword);
      }

      if (db && currentUser.uid && Object.keys(firestoreUpdates).length > 1) { // more than just updatedAt
            const userDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(userDocRef, firestoreUpdates);
      }

      const appUser = await mapFirebaseUserToAppUser(firebaseAuth.currentUser);
      setUser(appUser);
      setIsUserApproved(appUser?.isApproved || false);

      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_USER_EMAIL;
       if (appUser && adminEmail && appUser.email === adminEmail && appUser.isApproved) {
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
    <AuthContext.Provider value={{ user, loading, isAdmin, isUserApproved, signUp, logIn, logOut, updateUserProfile, sendUserPasswordResetEmail }}>
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
    

    