"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";

function IconEnvelope() {
  return (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-6 h-6">
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const emailLower = useMemo(() => user?.email?.toLowerCase() || "", [user?.email]);
  const [conversations, setConversations] = useState<Array<{
    id: number;
    eventSlug: string;
    groupName: string;
    createdAt: string;
    _count: { members: number; messages: number };
    lastMessageAt?: string | null;
  }>>([]);
  const [fetching, setFetching] = useState(false);
  const [unreads, setUnreads] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!emailLower) return;
      setFetching(true);
      try {
        const res = await fetch(`/api/conversations?memberEmail=${encodeURIComponent(emailLower)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setConversations(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setConversations([]);
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [emailLower]);

  // Calculer les non-lus à partir du localStorage
  useEffect(() => {
    if (!emailLower || conversations.length === 0) return;
    const map: Record<number, boolean> = {};
    for (const c of conversations) {
      const key = `conv:lastSeen:${emailLower}:${c.id}`;
      const seen = Number(localStorage.getItem(key) || 0);
      const last = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
      map[c.id] = last > 0 && seen < last;
    }
    setUnreads(map);
  }, [conversations, emailLower]);

  // SSE: écouter les nouveaux messages et basculer le non-lu en temps réel
  useEffect(() => {
    if (!emailLower) return;
    const src = new EventSource("/api/realtime/stream");
    const handler = (ev: MessageEvent) => {
      try {
        const m = JSON.parse(ev.data) as { id: number; conversationId: number; createdAt: string };
        // Mettre à jour lastMessageAt et l’état non-lu pour la conversation reçue
        setConversations((prev) => prev.map((c) => c.id === m.conversationId ? { ...c, lastMessageAt: m.createdAt } : c));
        setUnreads((prev) => {
          const key = `conv:lastSeen:${emailLower}:${m.conversationId}`;
          const seen = Number(localStorage.getItem(key) || 0);
          const last = new Date(m.createdAt).getTime();
          return { ...prev, [m.conversationId]: seen < last };
        });
      } catch {}
    };
    src.addEventListener("message:created", handler as any);
    return () => {
      try { src.removeEventListener("message:created", handler as any); } catch {}
      try { src.close(); } catch {}
    };
  }, [emailLower]);

  // Recalcul sur focus / visibilité
  useEffect(() => {
    const recalc = () => {
      const map: Record<number, boolean> = {};
      for (const c of conversations) {
        const key = `conv:lastSeen:${emailLower}:${c.id}`;
        const seen = Number(localStorage.getItem(key) || 0);
        const last = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
        map[c.id] = last > 0 && seen < last;
      }
      setUnreads(map);
    };
    window.addEventListener("focus", recalc);
    document.addEventListener("visibilitychange", recalc);
    return () => {
      window.removeEventListener("focus", recalc);
      document.removeEventListener("visibilitychange", recalc);
    };
  }, [conversations, emailLower]);

  const showEmpty = !fetching && (!conversations || conversations.length === 0);

  return (
    <main className="w-full max-w-[340px] md:max-w-[380px] mx-auto px-2 pb-20 pt-2 text-slate-900 dark:text-white">
      <header className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 grid place-items-center">
          <IconEnvelope />
        </div>
        <h1 className="text-sm font-medium">Messages</h1>
      </header>

      {fetching ? (
        <section className="rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur p-3 text-center">
          <div className="text-xs text-slate-700 dark:text-slate-300">Chargement…</div>
        </section>
      ) : showEmpty ? (
        <section className="rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur p-3 text-center">
          <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 grid place-items-center">
            <IconEnvelope />
          </div>
          <h2 className="text-base font-semibold mb-1">Aucune conversation</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
            Quand vous rejoignez des groupes ou démarrez un échange, vos conversations apparaissent ici.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm text-xs"
            >
              Explorer des événements
            </Link>
            <Link
              href="/requests"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300/60 dark:border-white/15 hover:bg-white/60 dark:hover:bg-white/10 transition text-xs"
            >
              Voir mes demandes
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur p-1">
          <ul className="divide-y divide-white/40 dark:divide-white/10">
            {conversations.map((c) => (
              <li key={c.id} className="">
                <Link href={`/messages/${c.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 grid place-items-center text-[11px] font-bold">
                    {c.groupName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`truncate text-sm ${unreads[c.id] ? "font-semibold" : "font-medium"}`}>{c.groupName}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] opacity-60 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</div>
                        {unreads[c.id] && (
                          <span aria-label="non lu" className="inline-block w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white/70 dark:ring-black/40" />
                        )}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <span className="truncate">{c.eventSlug}</span>
                      <span className="opacity-50">•</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-white/10 text-slate-900 dark:text-white border border-white/40 dark:border-white/10 whitespace-nowrap">
                        {c._count.members} membres
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
