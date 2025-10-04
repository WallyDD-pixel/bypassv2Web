"use client";
import Link from "next/link";
import { GlassCard, PillLink } from "@/components/ui";
import { events, eventSlug } from "@/data/events";
import React from "react";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/useRealtime";

export default function ExplorePage() {
  const { isAuthenticated, loading, user } = useAuth();
  const [mine, setMine] = React.useState<typeof events>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [ownedLoading, setOwnedLoading] = React.useState(true);

  React.useEffect(() => {
    if (!isAuthenticated || !user) {
      setMine([]);
      setCounts({});
      setOwnedLoading(false);
      return;
    }
    setOwnedLoading(true);
    const lowerEmail = user.email?.toLowerCase() || "";
    const userName = user.name;
    let aborted = false;
    const load = async () => {
      try {
        // Essayer serveur d’abord (cross-device)
        const res = await fetch(`/api/groups?ownerEmail=${encodeURIComponent(lowerEmail)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Array<{ eventSlug: string; name: string }>; 
        const slugs = new Set(data.map((g) => g.eventSlug));
        let owned = events.filter((e) => slugs.has(eventSlug(e)));
        owned.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
        if (!aborted) {
          setMine(owned);
          setOwnedLoading(false); // on a la liste, on peut afficher; les compteurs arriveront ensuite
        }

        // Compter les demandes côté serveur (fallback local si indispo)
        const reqCounts: Record<string, number> = {};
        for (const e of owned) {
          const slug = eventSlug(e);
          const myServerGroups = data.filter((g) => g.eventSlug === slug).map((g) => g.name);
          try {
            const r = await fetch(`/api/requests?eventSlug=${encodeURIComponent(slug)}`, { cache: "no-store" });
            if (!r.ok) throw new Error(String(r.status));
            const list = (await r.json()) as Array<{ groupName: string }>
            reqCounts[slug] = list.filter((it) => myServerGroups.includes(it.groupName)).length;
          } catch {
            // fallback local
            let total = 0;
            if (typeof window !== "undefined") {
              for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (!key || !key.startsWith(`joinRequests:${slug}:`)) continue;
                try {
                  const raw = window.localStorage.getItem(key);
                  const arr = raw ? (JSON.parse(raw) as any[]) : [];
                  for (const r of arr) {
                    const groupName = typeof r === "string" ? r : r.group;
                    if (myServerGroups.includes(groupName)) total++;
                  }
                } catch {}
              }
            }
            reqCounts[slug] = total;
          }
        }
        if (!aborted) setCounts(reqCounts);
      } catch {
        // Fallback: ancienne lecture locale
        try {
          const owned = events.filter((e) => {
            const slug = eventSlug(e);
            const raw = typeof window !== "undefined" ? window.localStorage.getItem(`createdGroups:${slug}`) : null;
            if (!raw) return false;
            try {
              const arr = JSON.parse(raw) as any[];
              return arr.some((g) => {
                const emailMatch = g.ownerEmail && lowerEmail && String(g.ownerEmail).toLowerCase() === lowerEmail;
                const nameMatch = userName ? g.name === `Groupe de ${userName}` : false;
                return emailMatch || nameMatch;
              });
            } catch {
              return false;
            }
          });
          owned.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
          if (!aborted) {
            setMine(owned);
            setOwnedLoading(false);
          }
        } catch {
          if (!aborted) {
            setMine([]);
            setOwnedLoading(false);
          }
        }
      }
    };
    load();
    return () => { aborted = true; };
  }, [isAuthenticated, user?.email, user?.name]);

  // Realtime: incrémenter/décrémenter les compteurs et recharger owned si un groupe est créé
  useRealtime({
    onGroupCreated: (p) => {
      // Si c'est un groupe du user, relire la liste owned rapidement
      if (!user?.email) return;
      if (String(p?.ownerEmail || "").toLowerCase() !== String(user.email).toLowerCase()) return;
      // Ré-exécuter le chargement léger côté client
      setOwnedLoading(true);
      (async () => {
        try {
          const res = await fetch(`/api/groups?ownerEmail=${encodeURIComponent(String(user.email).toLowerCase())}`, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as Array<{ eventSlug: string; name: string }>;
          const slugs = new Set(data.map((g) => g.eventSlug));
          let owned = events.filter((e) => slugs.has(eventSlug(e)));
          owned.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
          setMine(owned);
        } catch {}
        setOwnedLoading(false);
      })();
    },
    onJoinRequestCreated: (p) => {
      const slug = p?.eventSlug as string;
      const gName = p?.groupName as string;
      if (!slug || !gName) return;
      // Incrémente si l’événement est dans la liste
      setCounts((prev) => ({ ...prev, [slug]: Math.max(0, (prev[slug] || 0) + 1) }));
    },
    onJoinRequestUpdated: (p) => {
      const slug = p?.eventSlug as string;
      if (!slug) return;
      // Pas de décrément simple sans connaître avant/après; on peut forcer un recount léger
      (async () => {
        try {
          const r = await fetch(`/api/requests?eventSlug=${encodeURIComponent(slug)}`, { cache: "no-store" });
          if (!r.ok) return;
          const list = (await r.json()) as Array<{ groupName: string }>;
          // Ici on ne filtre pas par groupe possédé: le compteur représentait déjà cette agrégation
          setCounts((prev) => ({ ...prev, [slug]: list.length }));
        } catch {}
      })();
    },
  });

  const renderAuthGate = () => (
    <main className="max-w-md mx-auto px-4 py-16">
      <GlassCard className="shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
        <h1 className="text-xl sm:text-2xl font-extrabold text-white mb-2">Explorer</h1>
        <p className="text-white/80 mb-4">Connectez-vous pour voir les évènements où vous avez créé un groupe et gérer les demandes reçues.</p>
        <PillLink href="/login">Se connecter</PillLink>
      </GlassCard>
    </main>
  );

  const renderLoading = () => (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <GlassCard className="animate-pulse h-40" />
    </main>
  );

  if (loading) return renderLoading();

  if (!isAuthenticated) return renderAuthGate();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">Événements (groupes créés par vous)</h1>
        <p className="text-white/80">Choisissez un événement pour gérer les demandes à rejoindre.</p>
      </div>

      {ownedLoading ? (
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <GlassCard key={i} className="p-4 animate-pulse h-24" />
          ))}
        </ul>
      ) : mine.length === 0 ? (
  <GlassCard className="p-6 text-slate-700 dark:text-slate-200">
          <p>Vous n’avez encore créé aucun groupe. Créez-en un depuis la page d’un événement.</p>
          <PillLink href="/" className="mt-3">Voir les événements</PillLink>
        </GlassCard>
      ) : (
        <ul className="space-y-3">
          {mine.map((e, idx) => {
            const slug = eventSlug(e);
            const n = counts[slug] || 0;
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
                  {n > 0 && (
                    <div
                      aria-label={`${n} demande${n > 1 ? "s" : ""} de rejoindre`}
                      className="absolute -top-1 -left-1 min-w-5 h-5 px-1.5 rounded-full grid place-items-center text-[11px] font-bold bg-rose-600 text-white ring-2 ring-white/90 dark:ring-black/50"
                    >
                      {n}
                    </div>
                  )}
                </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(e.startAt))}
                </div>
                <div className="font-bold text-white truncate">{e.title}</div>
                <div className="text-sm text-slate-700 dark:text-slate-300 truncate">{e.venue}, {e.city}</div>
              </div>
                  <PillLink href={`/events/${eventSlug(e)}/requests`} size="sm" className="shrink-0">Voir</PillLink>
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
