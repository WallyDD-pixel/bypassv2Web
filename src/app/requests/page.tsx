"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { events, type Event, type Group, eventSlug } from "@/data/events";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/useRealtime";

// Lit toutes les demandes de l'utilisateur: localStorage keys joinRequests:<slug>:<email>
type StoredRequest = { group: string; amount?: number; currency?: string; status?: string; createdAt?: string; method?: string } | string;
function readAllRequests(emailLower: string) {
  if (typeof window === "undefined") return new Map<string, StoredRequest[]>();
  const map = new Map<string, StoredRequest[]>();
  for (const e of events) {
    const slug = eventSlug(e);
    const key = `joinRequests:${slug}:${emailLower}`;
    try {
      const raw = window.localStorage.getItem(key);
  const arr = raw ? (JSON.parse(raw) as StoredRequest[]) : [];
      if (arr.length) map.set(slug, arr);
    } catch {}
  }
  return map;
}

export default function MyRequestsPage() {
  const { isAuthenticated, user, loading } = useAuth();
  const [requests, setRequests] = useState<Map<string, StoredRequest[]>>(new Map());
  const [persistedGroups, setPersistedGroups] = useState<Map<string, Group[]>>(new Map());
  const [reqLoading, setReqLoading] = useState(true);
  const [serverRequests, setServerRequests] = useState<Array<{ id: number; eventSlug: string; groupName: string; amountCents: number | null; currency: string | null; method: string | null; status: string | null; createdAt: string }>>([]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { setReqLoading(false); return; }
    const emailLower = (user?.email || "").toLowerCase();
    setReqLoading(true);
    setRequests(readAllRequests(emailLower));
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(`/api/requests?memberEmail=${encodeURIComponent(emailLower)}`, { cache: "no-store" });
        const list = res.ok ? ((await res.json()) as Array<{ id: number; eventSlug: string; groupName: string; amountCents: number | null; currency: string | null; method: string | null; status: string | null; createdAt: string }>) : [];
        if (!aborted) setServerRequests(list);
        // Sync local statuses with server for same event/group (coarse match)
        try {
          for (const r of list) {
            const key = `joinRequests:${r.eventSlug}:${emailLower}`;
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
            const arr = raw ? (JSON.parse(raw) as StoredRequest[]) : [];
            let changed = false;
            for (let i = 0; i < arr.length; i++) {
              const it = arr[i];
              const name = typeof it === 'string' ? it : it.group;
              if (name === r.groupName) {
                if (typeof it === 'string') { arr[i] = { group: name, status: r.status || undefined, amount: r.amountCents != null ? r.amountCents / 100 : undefined, currency: (r.currency || undefined) as any, method: (r.method || undefined) as any, createdAt: r.createdAt }; changed = true; }
                else {
                  const next = { ...it } as any; const s = r.status || undefined;
                  if (next.status !== s) { next.status = s; changed = true; }
                  if (r.amountCents != null) { const v = r.amountCents / 100; if (next.amount !== v) { next.amount = v; changed = true; } }
                  if (r.currency && next.currency !== r.currency) { next.currency = r.currency; changed = true; }
                  if (r.method && next.method !== r.method) { next.method = r.method; changed = true; }
                  arr[i] = next;
                }
              }
            }
            if (changed && typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(arr));
          }
        } catch {}
      } catch {
        if (!aborted) setServerRequests([]);
      } finally {
        if (!aborted) setReqLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [loading, isAuthenticated, user]);

  // Realtime: si une demande est créée pour cet utilisateur ou mise à jour, refléter immédiatement
  useRealtime({
    onJoinRequestCreated: (p) => {
      const emailLower = (user?.email || "").toLowerCase();
      if (!emailLower || String(p?.memberEmail || "").toLowerCase() !== emailLower) return;
      setServerRequests((prev) => [
        {
          id: p.id,
          eventSlug: p.eventSlug ?? "",
          groupName: p.groupName ?? "",
          amountCents: typeof p.amountCents === "number" ? p.amountCents : null,
          currency: p.currency ?? null,
          method: p.method ?? null,
          status: p.status ?? null,
          createdAt: p.createdAt ?? "",
        },
        ...prev
      ]);
    },
    onJoinRequestUpdated: (p) => {
      const emailLower = (user?.email || "").toLowerCase();
      if (!emailLower || String(p?.memberEmail || "").toLowerCase() !== emailLower) return;
      setServerRequests((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? {
                ...x,
                status: p.status ?? null,
                amountCents: typeof p.amountCents === "number" ? p.amountCents : null,
                currency: p.currency ?? null,
                method: p.method ?? null,
              }
            : x
        )
      );
    },
  });

  // Charge les groupes créés localement pour compléter les métadonnées (ex: pricePerMale)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const map = new Map<string, Group[]>();
    for (const e of events) {
      const slug = eventSlug(e);
      try {
        const raw = window.localStorage.getItem(`createdGroups:${slug}`);
        const arr = raw ? (JSON.parse(raw) as Group[]) : [];
        if (arr.length) map.set(slug, arr);
      } catch {}
    }
    setPersistedGroups(map);
  }, []);

  const items = useMemo(() => {
    const rows: { event: Event; groupName: string; amount?: number; currency?: string; status?: string; createdAt?: string; method?: string; ownerAvatar?: string }[] = [];
    for (const e of events) {
      const slug = eventSlug(e);
      const reqsLocal = requests.get(slug) || [];
      const reqsServer = serverRequests.filter((r) => r.eventSlug === slug);
      const allGroups: Group[] = [...e.groupsGoing, ...(persistedGroups.get(slug) || [])];
      // Start with server requests (authoritative for status)
      for (const r of reqsServer) {
        const groupName = r.groupName;
        const found = allGroups.find((gg) => gg.name === groupName);
        const ownerAvatar = found?.avatarUrl;
        rows.push({
          event: e,
          groupName,
          amount: r.amountCents != null ? r.amountCents / 100 : undefined,
          currency: (r.currency || undefined) as any,
          status: (r.status || undefined) as any,
          createdAt: r.createdAt,
          method: (r.method || undefined) as any,
          ownerAvatar,
        });
      }
      // Merge local-only requests not present on server
      for (const r of reqsLocal) {
        const groupName = typeof r === "string" ? r : r.group;
        if (reqsServer.some((sr) => sr.groupName === groupName)) continue;
        const found = allGroups.find((gg) => gg.name === groupName);
        const ownerAvatar = found?.avatarUrl;
        if (typeof r === "string") rows.push({ event: e, groupName, ownerAvatar });
        else rows.push({ event: e, groupName, amount: r.amount, currency: r.currency, status: r.status, createdAt: r.createdAt, method: r.method, ownerAvatar });
      }
    }
    // ordre antéchronologique par date d'événement
    return rows.sort((a, b) => new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime());
  }, [requests, persistedGroups, serverRequests]);

  if (loading || reqLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-white/15 bg-white/5 p-6 animate-pulse h-40" />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
  <h1 className="text-xl sm:text-2xl font-extrabold text-white mb-4">Mes demandes</h1>

      {!isAuthenticated && !loading && (
        <div className="rounded-xl border border-white/15 p-4 bg-white/5">
          <p className="text-sm text-white/80">Connectez-vous pour voir vos demandes.</p>
          <Link href="/login" className="inline-block mt-2 text-sm font-semibold text-white underline">Se connecter</Link>
        </div>
      )}

      {isAuthenticated && items.length === 0 && (
        <div className="rounded-xl border border-white/15 p-4 bg-white/5 text-slate-700 dark:text-slate-300">
          Aucune demande envoyée pour le moment.
        </div>
      )}

      {isAuthenticated && items.length > 0 && (
        <ul className="space-y-3">
      {items.map(({ event, groupName, amount, currency, status, createdAt, method, ownerAvatar }, idx) => (
            <li key={`${eventSlug(event)}:${groupName}:${idx}`} className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-4 flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <img
            src={event.imageUrl}
            alt=""
            className="w-16 h-16 rounded-xl object-cover object-center"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const t = e.currentTarget as HTMLImageElement;
              t.onerror = null;
              t.src = "/window.svg";
            }}
          />
          {ownerAvatar && (
            <img
              src={ownerAvatar}
              alt=""
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full object-cover object-center ring-2 ring-white/90 dark:ring-black/50"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const t = e.currentTarget as HTMLImageElement;
                t.onerror = null;
                t.src = "/window.svg";
              }}
            />
          )}
        </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-600 dark:text-slate-300 truncate">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.startAt))}</div>
                <Link href={`/events/${eventSlug(event)}`} className="block font-bold text-white truncate">{event.title}</Link>
                <div className="text-sm text-slate-700 dark:text-slate-300 truncate">Groupe demandé: <span className="font-semibold">{groupName}</span></div>
                <div className="mt-1 text-[13px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span>
                    Montant payé: <span className="font-semibold">{typeof amount === 'number' ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(amount) : '—'}</span>
                    {typeof amount === 'number' && method ? ` • ${method === 'card' ? 'Carte' : 'PayPal'}` : ''}
                  </span>
                  {status === 'accepted' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">Acceptée</span>
                  )}
                  {status === 'refused' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-rose-600/30 bg-rose-500/15 text-rose-700 dark:text-rose-200">Refusée</span>
                  )}
                  {(!status || status === 'pending') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-amber-600/30 bg-amber-500/15 text-amber-700 dark:text-amber-200">En attente</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
