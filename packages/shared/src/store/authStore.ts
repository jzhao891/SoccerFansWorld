import { create } from 'zustand';
import type { AuthUser } from '../types/auth';

interface AuthState {
  currentUser: AuthUser | null;
  authReady: boolean;
  setCurrentUser: (user: AuthUser | null) => void;
  setAuthReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  authReady: false,
  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthReady: (ready) => set({ authReady: ready }),
}));
