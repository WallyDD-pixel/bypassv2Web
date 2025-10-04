"use client";
export const dynamic = "force-dynamic";
import Link from "next/link";
import { GlassCard, PillLink } from "@/components/ui";
import { events, eventSlug } from "@/data/events";
import React from "react";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/useRealtime";

export default function ScanPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const [mine, setMine] = React.useState<typeof events>([]);
  const [accepted, setAccepted] = React.useState<Array<{ slug: string; group: string; scanned?: boolean }>>([]);
  const isMale = (user?.gender || "").toLowerCase() === "male";
  const lowerEmail = (user?.email || "").toLowerCase();
  const userName = user?.name;

  const loadOrganizerEvents = React.useCallback(async () => {
    if (!lowerEmail) { setMine([]); return; }
    try {
      const res = await fetch(`/api/groups?ownerEmail=${encodeURIComponent(lowerEmail)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Array<{ eventSlug: string; name: string }>;
      const slugs = new Set(data.map((g) => g.eventSlug));
      let owned = events.filter((e) => slugs.has(eventSlug(e)));
      owned.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      setMine(owned);
    } catch {
      try {
        const owned = events.filter((e) => {
          const slug = eventSlug(e);
          if (typeof window === "undefined") return false;
          try {
            const scopedRaw = window.localStorage.getItem(`createdGroups:${slug}:${lowerEmail}`);
            const legacyRaw = window.localStorage.getItem(`createdGroups:${slug}`);
            const scopedArr = scopedRaw ? (JSON.parse(scopedRaw) as any[]) : [];
            const legacyArr = legacyRaw ? (JSON.parse(legacyRaw) as any[]) : [];
            const legacyMine = legacyArr.filter((g) => {
              const emailMatch = g?.ownerEmail && lowerEmail && String(g.ownerEmail).toLowerCase() === lowerEmail;
              const nameMatch = userName ? g?.name === `Groupe de ${userName}` : false;
              return emailMatch || nameMatch;
            });
            const merged = [...scopedArr, ...legacyMine];
            return merged.length > 0;
          } catch {
            return false;
          }
        });
        owned.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
        setMine(owned);
      } catch {
        setMine([]);
      }
    }
  }, [lowerEmail, userName]);

  const loadAcceptedGroupsForMale = React.useCallback(async () => {
    const uniq = new Set<string>();
    const list: Array<{ slug: string; group: string; scanned?: boolean }> = [];
    // 1) Essayer depuis le serveur (toutes demandes de l’utilisateur)
    try {
      const res = await fetch(`/api/requests?memberEmail=${encodeURIComponent(lowerEmail)}`, { cache: "no-store" });
      if (res.ok) {
        const server = await res.json();
        if (Array.isArray(server)) {
          for (const r of server) {
            const slug = String(r?.eventSlug || "");
            const groupName = String(r?.groupName || "");
            if (!slug || !groupName) continue;
            const status = String(r?.status || "");
            const isAccepted = status === "accepted" || !!r?.scannedAt || !!r?.payoutReleased;
            if (!isAccepted) continue;
            const key = `${slug}__${groupName}`;
            if (uniq.has(key)) continue;
            uniq.add(key);
            let scanned = false;
            try {
              const scanKey = `qrScanned:${slug}:${groupName}:${lowerEmail}`;
              scanned = !!(typeof window !== "undefined" ? window.localStorage.getItem(scanKey) : null) || !!r?.scannedAt || !!r?.payoutReleased;
            } catch {}
            list.push({ slug, group: groupName, scanned });
          }
        }
      }
    } catch {}
    // 2) Fallback localStorage si la liste est vide
    if (list.length === 0) {
      if (typeof window !== "undefined") {
        for (const e of events) {
          const slug = eventSlug(e);
          try {
            const key = `joinRequests:${slug}:${lowerEmail}`;
            const raw = window.localStorage.getItem(key);
            const arr = raw ? (JSON.parse(raw) as any[]) : [];
            for (const r of arr) {
              const groupName = typeof r === "string" ? r : r.group;
              const status = typeof r === "string" ? "accepted" : (r.status || "pending");
              if (groupName && status === "accepted") {
                const k = `${slug}__${groupName}`;
                if (uniq.has(k)) continue;
                uniq.add(k);
                let scanned = false;
                try {
                  const scanKey = `qrScanned:${slug}:${groupName}:${lowerEmail}`;
                  scanned = !!window.localStorage.getItem(scanKey);
                } catch {}
                list.push({ slug, group: groupName, scanned });
              }
            }
          } catch {}
        }
      }
    }
    // Trier par date d’événement
    try {
      list.sort((a, b) => {
        const ea = events.find((x) => eventSlug(x) === a.slug);
        const eb = events.find((x) => eventSlug(x) === b.slug);
        return new Date(ea?.startAt || 0).getTime() - new Date(eb?.startAt || 0).getTime();
      });
    } catch {}
    setAccepted(list);
  }, [lowerEmail]);

  React.useEffect(() => {
    if (!isAuthenticated || !user) {
      setMine([]);
      setAccepted([]);
      return;
    }
    if (isMale) {
      loadAcceptedGroupsForMale();
    } else {
      loadOrganizerEvents();
    }
  }, [isAuthenticated, user?.email, user?.name, isMale, loadAcceptedGroupsForMale, loadOrganizerEvents]);

  // Realtime: maj dynamique quand des évènements pertinents surviennent
  useRealtime({
    onJoinRequestUpdated: (p) => {
      if (!p) return;
      if (isMale && String(p.memberEmail || "").toLowerCase() === lowerEmail) {
        // recharger depuis le serveur (plus fiable que localStorage)
        loadAcceptedGroupsForMale();
      }
    },
    onGroupCreated: (p) => {
      if (!isMale && String(p?.ownerEmail || "").toLowerCase() === lowerEmail) {
        loadOrganizerEvents();
      }
    },
  });

  // Realtime: on refetch selon le rôle
  useRealtime({
    onGroupCreated: (p) => {
      if (!isAuthenticated || !user) return;
      const lowerEmail = user.email?.toLowerCase() || "";
      if (p?.ownerEmail && String(p.ownerEmail).toLowerCase() === lowerEmail) {
        // rafraîchir la liste des événements organisés
        (async () => {
          try {
            const res = await fetch(`/api/groups?ownerEmail=${encodeURIComponent(lowerEmail)}`, { cache: "no-store" });
            if (!res.ok) throw new Error(String(res.status));
            const data = (await res.json()) as Array<{ eventSlug: string; name: string }>; 
            const slugs = new Set(data.map((g) => g.eventSlug));
            let owned = events.filter((e) => slugs.has(eventSlug(e)));
            owned.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
            setMine(owned);
          } catch {}
        })();
      }
    },
    onJoinRequestUpdated: (p) => {
      if (!isAuthenticated || !user) return;
      const lowerEmail = user.email?.toLowerCase() || "";
      if (String(p?.memberEmail || "").toLowerCase?.() === lowerEmail) {
        // même stratégie: charger depuis le serveur
        loadAcceptedGroupsForMale();
      }
    },
  });

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <GlassCard className="animate-pulse h-40" />
      </main>
    );
  }

  const contentIfNotAuth = (
  <GlassCard className="shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          <h1 className="text-xl sm:text-2xl font-extrabold text-white mb-2">Scanner un QR code</h1>
      <p className="text-slate-600 dark:text-slate-300 mb-4">La gestion des demandes a été déplacée sous l’onglet Explorer (loupe).</p>
      <div className="flex gap-3">
        <PillLink href="/explore">Aller à Explorer</PillLink>
        <PillLink href="/login" variant="outline">Se connecter</PillLink>
      </div>
    </GlassCard>
  );

  if (!isAuthenticated) {
    return (
      <main className="max-w-md mx-auto px-4 py-16">
        {contentIfNotAuth}
      </main>
    );
  }

  const [navLoading, setNavLoading] = React.useState<string | null>(null);
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          {isMale ? "Générer mon QR" : "Scanner un QR code"}
        </h1>
        <p className="text-slate-600 dark:text-slate-300">
          {isMale
            ? "Voici les groupes qui ont accepté votre demande. Générez votre QR pour l’entrée."
            : "Choisissez un événement où vous organisez un groupe, puis scannez les QR codes des membres."}
        </p>
      </div>

      {isMale ? (
        accepted.length === 0 ? (
          <GlassCard className="p-6 text-slate-700 dark:text-slate-200">
            <p>Aucune demande acceptée pour le moment.</p>
            <PillLink href="/" className="mt-3">Voir les événements</PillLink>
          </GlassCard>
        ) : (
          <ul className="space-y-3">
            {accepted.map((a, idx) => {
              const e = events.find((x) => eventSlug(x) === a.slug)!;
              const groupEnc = encodeURIComponent(a.group);
              return (
                <li key={idx} className="flex items-center gap-4">
                  <GlassCard className="p-4 flex items-center gap-4 w-full shadow-[0_12px_40px_rgba(0,0,0,0.10)]">
                    <div className="relative w-16 h-16">
                      <img
                        src={e.imageUrl}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover object-center"
                        referrerPolicy="no-referrer"
                        onError={(ev) => {
                          const t = ev.currentTarget as HTMLImageElement;
                          t.onerror = null;
                          t.src = "/window.svg";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(e.startAt))}
                      </div>
                      <div className="font-bold text-white truncate">{e.title}</div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 truncate flex items-center gap-2">
                        <span>Groupe: {a.group}</span>
                        {a.scanned ? (
                          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                            Déjà scanné
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <PillLink href={`/qr/${a.slug}/${groupEnc}`} size="sm" className="shrink-0" loading={navLoading === `qr:${a.slug}:${groupEnc}`} onClick={() => setNavLoading(`qr:${a.slug}:${groupEnc}`)}>{a.scanned ? 'Voir mon QR' : 'Générer un QR'}</PillLink>
                  </GlassCard>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        mine.length === 0 ? (
          <GlassCard className="p-6 text-slate-700 dark:text-slate-200">
            <p>Vous n’avez encore créé aucun groupe. Créez-en un depuis la page d’un événement.</p>
            <PillLink href="/" className="mt-3">Voir les événements</PillLink>
          </GlassCard>
        ) : (
          <ul className="space-y-3">
            {mine.map((e, idx) => {
              const slug = eventSlug(e);
              return (
                <li key={idx} className="flex items-center gap-4">
                  <GlassCard className="p-4 flex items-center gap-4 w-full shadow-[0_12px_40px_rgba(0,0,0,0.10)]">
                    <div className="relative w-16 h-16">
                      <img
                        src={e.imageUrl}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover object-center"
                        referrerPolicy="no-referrer"
                        onError={(ev) => {
                          const t = ev.currentTarget as HTMLImageElement;
                          t.onerror = null;
                          t.src = "/window.svg";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(e.startAt))}
                      </div>
                      <div className="font-bold text-white truncate">{e.title}</div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 truncate">{e.venue}, {e.city}</div>
                    </div>
                    <PillLink href={`/scan/${slug}`} size="sm" className="shrink-0" loading={navLoading === `scan:${slug}`} onClick={() => setNavLoading(`scan:${slug}`)}>Scanner</PillLink>
                  </GlassCard>
                </li>
              );
            })}
          </ul>
        )
      )}
    </main>
  );
}
