"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import * as api from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean; // sedang memulihkan sesi dari token tersimpan
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const PUBLIC_PATHS = ["/login"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Pulihkan sesi dari token yang tersimpan saat pertama mount.
  useEffect(() => {
    let active = true;
    (async () => {
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.getMe();
        if (active) setUser(me);
      } catch {
        api.setToken(null); // token kadaluarsa/invalid
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Arahkan ke /login bila belum terautentikasi pada halaman terproteksi.
  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (!user && !isPublic) router.replace("/login");
    if (user && isPublic) router.replace("/");
  }, [user, loading, pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await api.login(email, password);
      api.setToken(token);
      setUser(u);
      router.replace("/");
    },
    [router],
  );

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
