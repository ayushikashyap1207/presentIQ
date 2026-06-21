import { create } from "zustand";
import { persist } from "zustand/middleware";

const API_BASE_URL = "http://localhost:8000";

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      signup: async (full_name, email, password) => {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name, email, password }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Registration failed");
        }
        const data = await res.json();
        set({ token: data.access_token, user: data.user });
      },
      login: async (email, password) => {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Login failed");
        }
        const data = await res.json();
        set({ token: data.access_token, user: data.user });
      },
      logout: () => set({ token: null, user: null }),
    }),
    { name: "presentiq-auth" }
  )
);
