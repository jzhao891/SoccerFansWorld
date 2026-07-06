'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useMapStore } from '@/store/mapStore';
import type { AuthUser } from '@sfw/shared';

// Flatten the Firebase User into our lean, SDK-agnostic AuthUser (only the fields the app uses).
function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

// Runs once at the app root: subscribes to Firebase auth state and mirrors it into the Zustand
// store as `currentUser` — the single reactive source every component reads (avoids each one
// owning its own listener or coupling to the Firebase SDK). onAuthStateChanged returns its
// unsubscribe fn, which doubles as the effect cleanup.
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setCurrentUser = useMapStore((s) => s.setCurrentUser);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user ? toAuthUser(user) : null);
    });
  }, [setCurrentUser]);

  return <>{children}</>;
}
