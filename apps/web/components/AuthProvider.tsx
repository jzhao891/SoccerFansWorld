"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useAuthStore } from "@sfw/shared";
import { auth } from "@/lib/firebase";
import { signInAnon, toAuthUser } from "@/lib/auth";

/**
 * Runs once at the app root. Ensures every visitor has a Firebase Auth uid —
 * anonymous today, upgradeable to Google/Apple/Email later via linkWithCredential
 * without changing the uid (see docs/AUTH_LLD_DECISIONS.md).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const setAuthReady = useAuthStore((s) => s.setAuthReady);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(toAuthUser(user));
        setAuthReady(true);
      } else {
        signInAnon().catch((err) => console.error("Anonymous sign-in failed:", err));
      }
    });
    return unsubscribe;
  }, [setCurrentUser, setAuthReady]);

  return <>{children}</>;
}
