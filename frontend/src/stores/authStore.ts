import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
};

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'vibefit-auth',
    }
  )
);
