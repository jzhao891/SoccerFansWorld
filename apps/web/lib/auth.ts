import { signInAnonymously, signOut as firebaseSignOut, type User } from "firebase/auth";
import type { AuthUser } from "@sfw/shared";
import { auth } from "./firebase";

export function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  };
}

/** Mock/placeholder provider until Google/Apple/Email sign-in ship — see docs/AUTH_LLD_DECISIONS.md. */
export function signInAnon() {
  return signInAnonymously(auth);
}

export function signOut() {
  return firebaseSignOut(auth);
}
