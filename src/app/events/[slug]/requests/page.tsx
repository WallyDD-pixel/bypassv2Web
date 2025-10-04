"use client";
import React, { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { events, eventSlug, getEventBySlug, type Group } from "@/data/events";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/useRealtime";

type StoredRequest = { group: string; amount?: number; currency?: string; status?: string; createdAt?: string; method?: string } | string;
type ServerJoinReq = {
  id: number;
  eventSlug: string;
  groupName: string;
  memberEmail: string;
  amountCents: number | null;
  currency: string | null;
  method: string | null;
  status: string | null;
  createdAt: string;
  scannedAt: string | null;
  payoutReleased: boolean | null;
};

type RequestItem = {
  id?: number;
  memberEmail?: string;
  group: string;
  amount?: number;
  currency?: string;
  method?: string;
  status?: string;
  createdAt?: string;
  scannedAt?: string | null;
  payoutReleased?: boolean | null;
  source: "server" | "local";
};

export default function EventRequestsPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = getEventBySlug(slug || "");
  // No early return; render a fallback below.
  // Mobile header title
  useEffect(() => {
    const title = `Demandes — ${event?.title || ""}`;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: title }));
    }
    return () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "" }));
      }
    };
  }, [event?.title]);

  const { isAuthenticated, user, loading } = useAuth();
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [requestsByGroup, setRequestsByGroup] = useState<Record<string, RequestItem[]>>({});
  const [ownedLoading, setOwnedLoading] = useState(true);
  const [reqLoading, setReqLoading] = useState(true);
  const [modal, setModal] = useState<{
    open: boolean;
    groupName?: string;
    index?: number;
    request?: StoredRequest;
  }>({ open: false });

  // Determine groups owned by current user for this event (server + local fallback)
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setOwnedGroups([]);
      setOwnedLoading(false);
      return;
    }
    setOwnedLoading(true);
    const lowerEmail = user.email?.toLowerCase() || "";
    const userName = user.name;
    let aborted = false;
    (async () => {
      try {
        // Essayer via API (cross-device)
        const res = await fetch(`/api/groups?slug=${encodeURIComponent(String(slug))}&ownerEmail=${encodeURIComponent(lowerEmail)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const server = (await res.json()) as Array<Group & { ownerEmail?: string }>;
        // Fusionner avec mock + persisted locaux
        const persistedRaw = typeof window !== "undefined" ? window.localStorage.getItem(`createdGroups:${slug}`) : null;
        const persisted = persistedRaw ? (JSON.parse(persistedRaw) as Group[]) : [];
        const merged: Group[] = [
          ...((event?.groupsGoing as Group[]) || []),
          ...persisted,
          ...server,
        ];
        const mine = merged.filter((g: any) => {
          const emailMatch = g?.ownerEmail && lowerEmail && String(g.ownerEmail).toLowerCase() === lowerEmail;
          const nameMatch = userName ? g?.name === `Groupe de ${userName}` : false;
          return emailMatch || nameMatch;
        });
        if (!aborted) setOwnedGroups(mine);
      } catch {
        // Fallback local uniquement
        try {
          const persistedRaw = typeof window !== "undefined" ? window.localStorage.getItem(`createdGroups:${slug}`) : null;
          const persisted = persistedRaw ? (JSON.parse(persistedRaw) as Group[]) : [];
          const all: Group[] = [
            ...((event?.groupsGoing as Group[]) || []),
            ...persisted,
          ];
          const mine = all.filter((g: any) => {
            const emailMatch = g?.ownerEmail && lowerEmail && String(g.ownerEmail).toLowerCase() === lowerEmail;
            const nameMatch = userName ? g?.name === `Groupe de ${userName}` : false;
            return emailMatch || nameMatch;
          });
          if (!aborted) setOwnedGroups(mine);
        } catch {
          if (!aborted) setOwnedGroups([]);
        }
      } finally {
        if (!aborted) setOwnedLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [isAuthenticated, user?.email, user?.name, slug]);

  // Read all requests for this event (server first), group by group name but only for owned groups
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setRequestsByGroup({});
      setReqLoading(false);
      return;
    }
    setReqLoading(true);
    let aborted = false;
    (async () => {
      const map: Record<string, RequestItem[]> = {};
      try {
        // Server requests pour tout l'événement
        const res = await fetch(`/api/requests?eventSlug=${encodeURIComponent(String(slug))}`, { cache: "no-store" });
        const list = res.ok ? ((await res.json()) as ServerJoinReq[]) : [];
        // Filtrer par groupes possédés
    for (const r of list) {
          if (!ownedGroups.some((g) => g.name === r.groupName)) continue;
          const key = r.groupName;
          if (!map[key]) map[key] = [];
          map[key].push({
            id: r.id,
      memberEmail: r.memberEmail,
            group: r.groupName,
            amount: r.amountCents != null ? r.amountCents / 100 : undefined,
            currency: r.currency || undefined,
            method: (r.method || undefined) as any,
            status: (r.status || undefined) as any,
            createdAt: r.createdAt,
      scannedAt: r.scannedAt,
      payoutReleased: r.payoutReleased,
            source: "server",
          });
        }
      } catch {}
      // Fallback/local merge: lire les localStorage et ajouter si absents
      try {
        if (typeof window !== "undefined") {
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (!key || !key.startsWith(`joinRequests:${slug}:`)) continue;
            try {
              const raw = window.localStorage.getItem(key);
              const arr = raw ? (JSON.parse(raw) as StoredRequest[]) : [];
              for (const r of arr) {
                const name = typeof r === "string" ? r : r.group;
                if (!name) continue;
                if (!ownedGroups.some((g) => g.name === name)) continue;
                const item: RequestItem = {
                  group: name,
                  amount: typeof r === "string" ? undefined : r.amount,
                  currency: typeof r === "string" ? undefined : r.currency,
                  method: typeof r === "string" ? undefined : r.method,
                  status: typeof r === "string" ? undefined : r.status,
                  createdAt: typeof r === "string" ? undefined : r.createdAt,
                  source: "local",
                };
                if (!map[name]) map[name] = [];
                // éviter doublons grossiers: même jour et même méthode/montant
                const exists = map[name].some((x) =>
                  x.source === "server" && (!item.createdAt || !x.createdAt || x.createdAt.slice(0,10) === item.createdAt.slice(0,10))
                );
                if (!exists) map[name].push(item);
              }
            } catch {}
          }
        }
      } catch {}
      if (!aborted) setRequestsByGroup(map);
      if (!aborted) setReqLoading(false);
    })();
    return () => { aborted = true; };
  }, [isAuthenticated, user?.email, slug, ownedGroups]);

  // Realtime: mettre à jour les listes pour cet event
  useRealtime({
    onJoinRequestCreated: (p) => {
      if (p?.eventSlug !== slug) return;
      const name = p?.groupName as string;
      if (!ownedGroups.some((g) => g.name === name)) return;
      setRequestsByGroup((prev) => {
        const copy = { ...prev } as Record<string, RequestItem[]>;
        const arr = copy[name] ? [...copy[name]] : [];
        arr.unshift({
          id: p.id,
          group: name,
          amount: typeof p.amountCents === 'number' ? p.amountCents / 100 : undefined,
          currency: p.currency ?? undefined,
          method: p.method ?? undefined,
          status: p.status ?? undefined,
          createdAt: p.createdAt ?? undefined,
          source: "server",
        });
        copy[name] = arr;
        return copy;
      });
    },
    onJoinRequestUpdated: (p) => {
      if (p?.eventSlug !== slug) return;
      const name = p?.groupName as string;
      setRequestsByGroup((prev) => {
        const copy = { ...prev } as Record<string, RequestItem[]>;
        const arr = copy[name] ? [...copy[name]] : [];
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i];
          if (it.source === 'server' && it.id === p.id) {
            arr[i] = {
              ...it,
              status: p.status ?? it.status,
              amount: typeof p.amountCents === 'number' ? p.amountCents / 100 : it.amount,
              currency: p.currency ?? it.currency,
              method: p.method ?? it.method,
              scannedAt: (p as any).scannedAt ?? it.scannedAt,
              payoutReleased: (p as any).payoutReleased ?? it.payoutReleased,
            };
            break;
          }
        }
        copy[name] = arr;
        return copy;
      });
    },
  });

  const total = useMemo(() => Object.values(requestsByGroup).reduce((a, arr) => a + arr.length, 0), [requestsByGroup]);

  const updateRequestStatusLocal = (targetEmailKey: string, groupName: string, indexInEmail: number, newStatus: "accepted" | "refused") => {
    try {
      const raw = window.localStorage.getItem(targetEmailKey);
      const arr = raw ? (JSON.parse(raw) as StoredRequest[]) : [];
      const r = arr[indexInEmail];
      const obj = typeof r === "string" ? { group: r } as any : { ...r };
      obj.status = newStatus;
      arr[indexInEmail] = obj;
      window.localStorage.setItem(targetEmailKey, JSON.stringify(arr));
    } catch {}
  };

  const renderLoading = (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="rounded-2xl border border-white/15 p-4 bg-white/60 animate-pulse h-40" />
    </main>
  );

  if (!event) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-white/15 p-4 bg-white/60 introuvable.</div>
      </main>
    );
  }

  if (loading) return renderLoading;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-4 flex items-center gap-3">
        {/* Desktop title only; back on mobile via MobileHeader */}
        <h1 className="hidden md:block text-2xl font-extrabold text-slate-900 de rejoint</h1>
        <span className="ml-auto inline-flex items-center gap-2 text-sm text-slate-600
          <img src={event.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
          {event.title}
        </span>
      </div>

      {!isAuthenticated && !loading && (
        <div className="rounded-xl border border-white/15 p-4 bg-white/60
          <p className="text-sm text-slate-700 pour voir les demandes.</p>
          <Link href="/login" className="inline-block mt-2 text-sm font-semibold text-slate-900 underline">Se connecter</Link>
        </div>
      )}

      {isAuthenticated && (ownedLoading ? (
        <div className="rounded-xl border border-white/15 p-4 bg-white/60 animate-pulse h-24" />
      ) : ownedGroups.length === 0) && (
        <div className="rounded-xl border border-white/15 p-4 bg-white/60 text-slate-700
          Vous n’avez créé aucun groupe pour cet événement.
        </div>
      )}

      {isAuthenticated && ownedGroups.length > 0 && (reqLoading ? (
        <div className="rounded-xl border border-white/15 p-4 bg-white/60 animate-pulse h-24" />
      ) : total === 0) && (
        <div className="rounded-xl border border-white/15 p-4 bg-white/60 text-slate-700
          Aucune demande reçue pour l’instant.
        </div>
      )}

      {isAuthenticated && total > 0 && (
        <div className="space-y-6">
          {ownedGroups.map((g) => {
            const list = requestsByGroup[g.name] || [];
            if (!list.length) return null;
            return (
              <section key={g.name} className="rounded-2xl border border-white/15 bg-white/70 backdrop-blur-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img src={g.avatarUrl || "/window.svg"} alt="" className="w-10 h-10 rounded-full object-cover object-center" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{g.name}</div>
                    <div className="text-sm text-slate-600 demande{list.length > 1 ? "s" : ""}</div>
                  </div>
                </div>
                <ul className="divide-y divide-black/10
                  {list.map((r, i) => {
                    const amount = r.amount;
                    const currency = r.currency;
                    const method = r.method;
                    const status = r.status;
                    const scanned = !!r.scannedAt;
                    return (
                      <li
                        key={i}
                        className="py-3 flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 grid place-items-center text-[11px] font-bold text-slate-800
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-800 truncate">Demandeur•euse</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600
                            <span>
                              {typeof amount === "number" ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(amount) : "—"}
                              {method ? ` • ${method === "card" ? "Carte" : "PayPal"}` : ""}
                            </span>
                            {scanned && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-sky-600/30 bg-sky-500/15 text-sky-700 text-[11px]">Scanné</span>
                            )}
                            {status === "accepted" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-emerald-600/30 bg-emerald-500/15 text-emerald-700 text-[11px]">Acceptée</span>
                            )}
                            {status === "refused" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-rose-600/30 bg-rose-500/15 text-rose-700 text-[11px]">Refusée</span>
                            )}
                            {(!status || status === "pending") && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-amber-600/30 bg-amber-500/15 text-amber-700 text-[11px]">En attente</span>
                            )}
                          </div>
                        </div>
            {status !== "accepted" && (
                          <button
                            className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg border border-white/15 bg-white/70 hover:bg-white"
              onClick={() => setModal({ open: true, groupName: g.name, index: i, request: r as any })}
                          >
                            Gérer
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Modal Accepter/Refuser */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModal({ open: false })} />
          <div className="relative w-full sm:max-w-md rounded-2xl border border-white/15 bg-white/95 p-5 shadow-2xl">
            <div className="mb-3 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-200">
                <img src={event.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 truncate">{modal.groupName}</div>
                <div className="text-xs text-slate-600 de rejoint à valider</div>
              </div>
            </div>

            <div className="text-sm text-slate-700 space-y-2">
              <p>Souhaitez-vous accepter ou refuser cette demande ?</p>
              <p>
                En acceptant, la personne sera accréditée pour rejoindre votre groupe à l’événement. Le paiement éventuel est déjà préautorisé/capturé et
                l’argent est conservé de manière sécurisée. Vous recevrez le montant qui vous est dû après avoir scanné le QR code du participant le jour de l’événement,
                moins les frais de la plateforme.
              </p>
              <p className="text-[12px] text-slate-500
                Les frais de plateforme seront précisés ultérieurement et déduits automatiquement lors du versement.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="px-3 py-1.5 text-sm rounded-lg border border-white/15 bg-white/70 onClick={() => setModal({ open: false })}>Annuler</button>
              <button
                className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 text-white hover:opacity-90"
                onClick={async () => {
                  // Trouver la clé email correspondante et index à mettre à jour
                  try {
                    const gName = modal.groupName!;
                    const req = modal.request as any as RequestItem;
                    // Server update si id disponible
                    if (req?.source === 'server' && req?.id != null) {
                      try { await fetch(`/api/requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'refused' }) }); } catch {}
                    } else if (typeof window !== 'undefined') {
                      for (let i = 0; i < window.localStorage.length; i++) {
                        const key = window.localStorage.key(i);
                        if (!key || !key.startsWith(`joinRequests:${slug}:`)) continue;
                        const raw = window.localStorage.getItem(key);
                        const arr = raw ? (JSON.parse(raw) as StoredRequest[]) : [];
                        const idx = arr.findIndex((x, j) => j === modal.index && (typeof x === 'string' ? x === gName : (x as any).group === gName));
                        if (idx !== -1) { updateRequestStatusLocal(key, gName, idx, 'refused'); break; }
                      }
                    }
                  } catch {}
                  setModal({ open: false });
                  // rafraîchir la vue
                  window.location.reload();
                }}
              >
                Refuser
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:opacity-90"
                onClick={async () => {
                  try {
                    const gName = modal.groupName!;
                    const req = modal.request as any as RequestItem;
                    if (req?.source === 'server' && req?.id != null) {
                      try { await fetch(`/api/requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'accepted' }) }); } catch {}
                    } else if (typeof window !== 'undefined') {
                      for (let i = 0; i < window.localStorage.length; i++) {
                        const key = window.localStorage.key(i);
                        if (!key || !key.startsWith(`joinRequests:${slug}:`)) continue;
                        const raw = window.localStorage.getItem(key);
                        const arr = raw ? (JSON.parse(raw) as StoredRequest[]) : [];
                        const idx = arr.findIndex((x, j) => j === modal.index && (typeof x === 'string' ? x === gName : (x as any).group === gName));
                        if (idx !== -1) { updateRequestStatusLocal(key, gName, idx, 'accepted'); break; }
                      }
                    }
                  } catch {}
                  setModal({ open: false });
                  window.location.reload();
                }}
              >
                Accepter
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
