"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/useRealtime";

// Calcule un compteur de notifications (ex: demandes en attente)
export function useBadges() {
  const { isAuthenticated, user } = useAuth();
  const emailLower = (user?.email || "").toLowerCase();
  const [pendingCount, setPendingCount] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);

  const refresh = async () => {
    if (!isAuthenticated || !emailLower) { setPendingCount(0); return; }
    try {
      const res = await fetch(`/api/requests?memberEmail=${encodeURIComponent(emailLower)}`, { cache: "no-store" });
      const list: Array<{ status: string | null }> = res.ok ? await res.json() : [];
      const count = list.filter((r) => !r.status || r.status === "pending").length;
      setPendingCount(count);
    } catch {
      // Fallback très simple en localStorage si offline
      try {
        let total = 0;
        if (typeof window !== "undefined") {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i) || "";
            if (k.startsWith("joinRequests:") && k.endsWith(`:${emailLower}`)) {
              const raw = window.localStorage.getItem(k);
              const arr = raw ? JSON.parse(raw) as Array<string | { status?: string }> : [];
              total += arr.filter((x) => typeof x === 'string' ? true : (!x.status || x.status === 'pending')).length;
            }
          }
        }
        setPendingCount(total);
      } catch { setPendingCount(0); }
    }
  };

  useEffect(() => { refresh(); }, [isAuthenticated, emailLower]);

  // Calcule le nombre de conversations avec non-lu depuis localStorage
  const recomputeMessagesUnread = async () => {
    if (!isAuthenticated || !emailLower) { setMessagesUnread(0); return; }
    try {
      const res = await fetch(`/api/conversations?memberEmail=${encodeURIComponent(emailLower)}`, { cache: "no-store" });
      const list: Array<{ id: number; lastMessageAt?: string | null }> = res.ok ? await res.json() : [];
      let total = 0;
      for (const c of list) {
        const key = `conv:lastSeen:${emailLower}:${c.id}`;
        const seen = Number(localStorage.getItem(key) || 0);
        const last = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
        if (last > 0 && seen < last) total++;
      }
      setMessagesUnread(total);
    } catch {
      setMessagesUnread(0);
    }
  };

  useEffect(() => { recomputeMessagesUnread(); }, [isAuthenticated, emailLower]);

  useRealtime({
    onJoinRequestCreated: (p) => {
      if (String(p?.memberEmail || "").toLowerCase() !== emailLower) return;
      // Nouvelle demande => potentiellement augmente
      setPendingCount((v) => v + 1);
    },
    onJoinRequestUpdated: (p) => {
      if (String(p?.memberEmail || "").toLowerCase() !== emailLower) return;
      // Si status passe à accepted/refused => diminue; si redevient pending => augmente
      const s = (p.status || "pending").toLowerCase();
      setPendingCount((v) => {
        if (s === "accepted" || s === "refused") return Math.max(0, v - 1);
        return v; // pending: ne change pas (création déjà comptée)
      });
    },
    onMessageCreated: (p: any) => {
      // Une nouvelle notif potentielle reçue: recalcule
      recomputeMessagesUnread();
    },
  });

  return { badges: { requests: pendingCount, messages: messagesUnread } } as const;
}
