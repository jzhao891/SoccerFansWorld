// Lean auth identity for the app store — intentionally free of any Firebase SDK dependency so
// packages/shared stays SDK-agnostic. Each app's AuthProvider maps the platform FirebaseUser
// into this shape and writes it to the Zustand store.
export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null; // OAuth profile photo; null for Apple and email/password
};
