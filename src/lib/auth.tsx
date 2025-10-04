"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

export type User = {
  name: string;
  email?: string;
  avatarUrl?: string;
  balanceCents: number;
  pendingBalanceCents?: number;
  gender?: "male" | "female";
};

type AuthCtx = {
  isAuthenticated: boolean;
  loading: boolean;
  user: User | null;
  login: () => void;
  logout: () => void;
  setUser: (u: User | null) => void;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [{ isAuthenticated, user }, setAuthState] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const v = window.localStorage.getItem("auth:logged") === "1";
        const raw = window.localStorage.getItem("auth:user");
        const u = raw ? (JSON.parse(raw) as User) : null;
        return { isAuthenticated: v, user: u };
      }
    } catch {}
    return { isAuthenticated: false, user: null };
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Premier mount côté client: s'assurer que l'état auth est cohérent et couper le loading
    try {
      if (typeof window !== "undefined") {
        const v = window.localStorage.getItem("auth:logged") === "1";
        const raw = window.localStorage.getItem("auth:user");
        const u = raw ? (JSON.parse(raw) as User) : null;
        setAuthState({ isAuthenticated: v, user: u });
        if (u?.email) {
          const emailLower = String(u.email || "").toLowerCase();
          if (emailLower) {
            localStorage.setItem(`auth:users:${emailLower}`, JSON.stringify(u));
          }
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  const login = () => {
    localStorage.setItem("auth:logged", "1");
    // Seed a demo user if none exists
    const existing = localStorage.getItem("auth:user");
    if (!existing) {
      const demo: User = {
        name: "Utilisateur",
        email: "user@example.com",
        avatarUrl: undefined,
  balanceCents: 12345,
  pendingBalanceCents: 2500,
      };
      localStorage.setItem("auth:user", JSON.stringify(demo));
  setAuthState((s) => ({ ...s, user: demo }));
    }
  // Cookies côté client pour vérif serveur
  try {
    const raw = localStorage.getItem("auth:user");
    const u = raw ? (JSON.parse(raw) as User) : null;
    if (u?.email) {
      const maxAge = 60 * 60 * 24 * 30; // 30j
      document.cookie = `auth-email=${encodeURIComponent(u.email)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      document.cookie = `auth-name=${encodeURIComponent(u.name || "")}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    }
  } catch {}
  setAuthState((s) => ({ ...s, isAuthenticated: true }));
  };
  const logout = () => {
    localStorage.removeItem("auth:logged");
    localStorage.removeItem("auth:user");
    try {
      // Effacer cookies
      document.cookie = `auth-email=; Path=/; Max-Age=0; SameSite=Lax`;
      document.cookie = `auth-name=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {}
    setAuthState({ isAuthenticated: false, user: null });
  };

  const setUser = (u: User | null) => {
  setAuthState((s) => ({ ...s, user: u }));
    if (u) {
      localStorage.setItem("auth:user", JSON.stringify(u));
      try {
        const emailLower = String(u.email || "").toLowerCase();
        if (emailLower) localStorage.setItem(`auth:users:${emailLower}`, JSON.stringify(u));
        const maxAge = 60 * 60 * 24 * 30; // 30j
        document.cookie = `auth-email=${encodeURIComponent(u.email || "")}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
        document.cookie = `auth-name=${encodeURIComponent(u.name || "")}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      } catch {}
    } else {
      localStorage.removeItem("auth:user");
      try {
        document.cookie = `auth-email=; Path=/; Max-Age=0; SameSite=Lax`;
        document.cookie = `auth-name=; Path=/; Max-Age=0; SameSite=Lax`;
      } catch {}
    }
  };

  return <Ctx.Provider value={{ isAuthenticated, user, login, logout, setUser, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
