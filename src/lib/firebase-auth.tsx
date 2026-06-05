"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  type User,
  type Auth,
} from "firebase/auth";
import { firebaseApp } from "./firebase";

const syncFirebaseReportsToLocalCache = createClientOnlyFn(async (uid: string) => {
  const mod = await import("./report-persistence");
  return mod.syncFirebaseReportsToLocalCache(uid);
});

// Re-tag any local analyses that were saved under an anonymous device UUID
// so the user's history/dashboard shows them all once they sign in.
const reTagOrphanedLocalAnalyses = createClientOnlyFn(async (uid: string) => {
  const mod = await import("./local-analysis");
  return mod.reTagLocalAnalyses("any", uid);
});

type FirebaseAuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextType | null>(null);

export let firebaseAuth: Auth | null = null;

type Props = {
  children: ReactNode;
};

export function FirebaseAuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncTokenRef = useRef(0);

  useEffect(() => {
    if (!firebaseApp) {
      setLoading(false);
      console.warn(
        "Firebase is not configured. Set VITE_FIREBASE_* env vars to enable auth.",
      );
      return;
    }

    const auth = getAuth(firebaseApp);
    firebaseAuth = auth;

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        const token = ++syncTokenRef.current;
        setUser(firebaseUser);

        if (!firebaseUser) {
          setLoading(false);
          return;
        }

        setLoading(true);
        // Bring orphan analyses (saved pre-login under the device UUID) under
        // the new firebase UID so they show up in history immediately.
        void reTagOrphanedLocalAnalyses(firebaseUser.uid).catch((err) => {
          console.error("Local analysis re-tag failed:", err);
        });
        void syncFirebaseReportsToLocalCache(firebaseUser.uid)
          .catch((err) => {
            console.error("Firebase report sync failed:", err);
          })
          .finally(() => {
            if (syncTokenRef.current === token) {
              setLoading(false);
            }
          });
      },
      (err) => {
        console.error("Firebase auth state error:", err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
      firebaseAuth = null;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!firebaseApp) {
      throw new Error("Firebase is not configured. Check your environment variables.");
    }
    setError(null);
    try {
      const auth = getAuth(firebaseApp);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign in failed.";
      setError(message);
      throw err;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      if (!firebaseApp) {
        throw new Error("Firebase is not configured. Check your environment variables.");
      }
      setError(null);
      try {
        const auth = getAuth(firebaseApp);
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName && cred.user) {
          await updateProfile(cred.user, { displayName });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Sign up failed.";
        setError(message);
        throw err;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (!firebaseApp) return;
    try {
      const auth = getAuth(firebaseApp);
      await firebaseSignOut(auth);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign out failed.";
      setError(message);
      throw err;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseApp) {
      throw new Error("Firebase is not configured. Check your environment variables.");
    }
    setError(null);
    try {
      const auth = getAuth(firebaseApp);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      // Popup closed by user is not an error we want to surface
      if (err instanceof Error && err.message?.includes("popup-closed")) return;
      const message = err instanceof Error ? err.message : "Google sign in failed.";
      setError(message);
      throw err;
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!firebaseApp) {
      throw new Error("Firebase is not configured. Check your environment variables.");
    }
    const targetEmail = email.trim();
    if (!targetEmail) {
      throw new Error("Enter an email address to reset the password.");
    }

    setError(null);
    try {
      const auth = getAuth(firebaseApp);
      await sendPasswordResetEmail(auth, targetEmail);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Password reset failed.";
      setError(message);
      throw err;
    }
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    if (!firebaseApp) return;
    try {
      const auth = getAuth(firebaseApp);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No authenticated user.");
      await updateProfile(currentUser, { displayName: name });
      // Force re-render by triggering auth state
      setUser(auth.currentUser);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Update failed.";
      setError(message);
      throw err;
    }
  }, []);

  const getIdToken = useCallback(async () => {
    if (!firebaseApp) return null;
    const auth = getAuth(firebaseApp);
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  return (
    <FirebaseAuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        sendPasswordReset,
        updateDisplayName,
        getIdToken,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth(): FirebaseAuthContextType {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error(
      "useFirebaseAuth must be used within a FirebaseAuthProvider.",
    );
  }
  return context;
}
