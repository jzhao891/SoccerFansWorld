import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from './firebase';

// All Firebase Auth calls for the WEB app live here (uses signInWithPopup, which is
// browser-only). Mobile gets its own apps/mobile/lib/auth.ts with native flows. Callers
// trigger these; the resulting auth-state change is observed centrally by AuthProvider
// (onAuthStateChanged), which updates the store — callers don't read the returned credential.

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Manual email/password sign-up (AUTH_HLD §2). New accounts are created here; the same
// onAuthStateChanged path then signs the user in.
export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signOut() {
  return firebaseSignOut(auth);
}
