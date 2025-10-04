"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PillButton, PillLink } from "@/components/ui";
import { getEventBySlug } from "@/data/events";
import { notFound, useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { GROUP_CREATOR_GENDER } from "@/config/policies";
import { listCreatedGroupsForEvent } from "@/lib/storage";
import { useRealtime } from "@/lib/useRealtime";

type GroupLite = { name: string; members?: number; ownerEmail?: string; avatarUrl?: string };

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const event = getEventBySlug(slug || "");
  const [showFullDesc, setShowFullDesc] = useState(false);
  // Merge persisted groups from localStorage (typed lite to avoid any)
  const [persistedGroups, setPersistedGroups] = useState<GroupLite[]>([]);
  const [serverGroups, setServerGroups] = useState<GroupLite[]>([]);

  useEffect(() => {
    try {
      setPersistedGroups(listCreatedGroupsForEvent(slug || ""));
    } catch {
      setPersistedGroups([]);
    }
  }, [slug]);

  // Charger les groupes depuis l'API (Prisma)
  useEffect(() => {
    let abort = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/groups?slug=${encodeURIComponent(String(slug || ""))}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!abort) setServerGroups(Array.isArray(data) ? data : []);
      } catch {
        if (!abort) setServerGroups([]);
      }
    };
    run();
    return () => { abort = true; };
  }, [slug]);

  // Realtime: refetch quand des groupes sont créés ou que des demandes évoluent
  useRealtime({
    onGroupCreated: (p) => {
      if (!p?.eventSlug || String(p.eventSlug) !== String(slug)) return;
      // recharger les groupes
      (async () => {
        try {
          const res = await fetch(`/api/groups?slug=${encodeURIComponent(String(slug || ""))}`, { cache: "no-store" });
          const data = await res.json();
          setServerGroups(Array.isArray(data) ? data : []);
        } catch {}
      })();
    },
    onJoinRequestUpdated: (p) => {
      if (!p?.eventSlug || String(p.eventSlug) !== String(slug)) return;
      // Une demande acceptée peut faire évoluer les compteurs/membres: on refetch
      (async () => {
        try {
          const res = await fetch(`/api/groups?slug=${encodeURIComponent(String(slug || ""))}`, { cache: "no-store" });
          const data = await res.json();
          setServerGroups(Array.isArray(data) ? data : []);
        } catch {}
      })();
    },
  });

  // N'afficher que les groupes réels (API + localStorage), plus de mock !
  const allGroups = useMemo(() => {
    const merged: GroupLite[] = [
      ...serverGroups,
      ...persistedGroups,
    ];
    const seen = new Set<string>();
    return merged.filter((g) => {
      const name = String(g?.name || "");
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [serverGroups, persistedGroups]);

  const hasGroups = allGroups.length > 0;
  const canCreateGroup = isAuthenticated && (user?.gender || "").toLowerCase() === GROUP_CREATOR_GENDER;
  const hasOwnGroup = React.useMemo(() => {
    const userEmail = user?.email?.toLowerCase();
    const userName = user?.name;
    return allGroups.some((g) => {
      const emailMatch = (g as GroupLite).ownerEmail && userEmail && String((g as GroupLite).ownerEmail).toLowerCase() === userEmail;
      const nameMatch = userName ? (g as GroupLite).name === `Groupe de ${userName}` : false;
      return emailMatch || nameMatch;
    });
  }, [allGroups, user?.email, user?.name]);

  const d = new Date(event?.startAt || Date.now());
  const fullDate = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Mobile header title for deep page
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: event?.title || "" }));
    }
    return () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "" }));
      }
    };
  }, [event?.title]);

  if (!event) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/5 backdrop-blur-xl p-6 text-slate-700 dark:text-slate-300">
          Événement introuvable.
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
    <div className="mb-6">
        <Link
          href="/"
          aria-label="Retour à l’accueil"
      className="hidden md:inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/5 backdrop-blur-xl px-3 py-2 text-sm font-medium text-slate-800 dark:text-white shadow hover:shadow-lg hover:-translate-y-px transition will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-80">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Retour à l’accueil</span>
        </Link>
      </div>

      {/* Hero image + overlay meta */}
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_16px_60px_rgba(0,0,0,0.22)]">
        <div className="aspect-[16/8] sm:aspect-[16/6] md:aspect-[16/5] w-full relative">
          <img src={event?.imageUrl} alt={event?.title || ""} className="w-full h-full object-cover" />
          {/* gradient for depth */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
          {/* top-left pill meta */}
          <div className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white/95 backdrop-blur-2xl bg-black/30 ring-1 ring-white/30 shadow">
            <span className="opacity-95">{fullDate}</span>
            <span className="opacity-60">•</span>
            <span className="opacity-95">{event?.venue}, {event?.city}</span>
          </div>
        </div>
      </div>

      {/* Title + meta */}
      <header className="mt-6">
        {/* Desktop title only; MobileHeader shows it on mobile */}
        <h1 className="hidden md:block text-3xl font-extrabold tracking-tight text-white mb-2">
          {event?.title}
        </h1>
        <p className="text-white/80">
          {fullDate} • {event?.venue}, {event?.city}
        </p>
      </header>

      <section className="mt-8 md:mt-10">
        {/* Bloc central d’actions (CTA/groupes/billetterie) */}
        <aside className="max-w-xl mx-auto rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-5 md:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.14)] flex flex-col gap-4 md:gap-5">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Groupes qui y vont</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 -mt-1">Rejoignez un groupe existant ou créez le vôtre en quelques instants.</p>

          <div className="flex flex-col gap-2 mt-1">
            <PillButton
              aria-label="Rejoindre un groupe pour cet événement"
              disabled={loading}
              onClick={() => {
                if (loading) return;
                if (!isAuthenticated) return router.push("/login");
                router.push(`/events/${slug}/join`);
              }}
            >
              Rejoindre un groupe
            </PillButton>

            <PillButton
              aria-label="Créer un groupe pour cet événement"
              title={
                !loading && isAuthenticated && hasOwnGroup
                  ? "Vous avez déjà créé un groupe pour cet événement"
                  : (!loading && isAuthenticated && !canCreateGroup
                    ? "Seules les utilisatrices peuvent créer un groupe"
                    : undefined)
              }
              disabled={loading || (isAuthenticated && (!canCreateGroup || hasOwnGroup))}
              onClick={() => {
                if (loading) return;
                if (!isAuthenticated) return router.push("/login");
                if (!canCreateGroup || hasOwnGroup) return;
                router.push(`/events/${slug}/create-group`);
              }}
              variant="outline"
            >
              Créer un groupe
            </PillButton>
            {isAuthenticated && !loading && !canCreateGroup && (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Seules les utilisatrices peuvent créer un groupe. 
              </p>
            )}
            {hasOwnGroup && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs px-3 py-2">
                Vous avez déjà créé un groupe pour cet événement.
              </div>
            )}
          </div>
      {allGroups.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-300">Désolé, pour l’instant il n’y a aucun groupe qui va à cet événement.</p>
          ) : (
            <div className={`flex items-center py-1 ${loading ? "opacity-60 blur-[2px] grayscale" : !isAuthenticated ? "opacity-60 blur-[2px] grayscale" : ""}`}>
        {allGroups.slice(0, 5).map((g, i) => (
                <div
                  key={i}
                  title={`${g.name} • ${g.members} membres`}
                  className={`group relative w-12 h-12 rounded-full -ml-4 first:ml-0 ring-2 ring-white/80 dark:ring-black/40 shadow transition-transform duration-150 hover:scale-105 hover:z-50`}
                  style={{ zIndex: 50 - i }}
                >
                  {g.avatarUrl ? (
                    <img
                      src={g.avatarUrl}
                      alt={`Photo du créateur — ${g.name}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover object-center"
                      onError={(e) => {
                        const t = e.currentTarget as HTMLImageElement;
                        t.onerror = null;
                        t.src = "/window.svg";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-300 to-slate-500 dark:from-white/20 dark:to-white/10 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
        {allGroups.length > 5 && (
                <div className="-ml-4 w-12 h-12 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center text-[11px] font-bold ring-2 ring-white/80 dark:ring-black/40 shadow">
          +{allGroups.length - 5}
                </div>
              )}
            </div>
          )}

          {/* Doublon supprimé: un seul bloc CTA au-dessus suffit */}

          {/* Billetterie (Shotgun) */}
          <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/15">
            <div className="uppercase text-xs tracking-[0.18em] text-slate-600 dark:text-slate-300">Billetterie</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {event?.isFree ? (
                <>Gratuit</>
              ) : typeof event?.minPrice === "number" ? (
                <>À partir de {event.minPrice} {event?.currency === "EUR" ? "€" : event?.currency}</>
              ) : (
                <>{event?.price}</>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Les billets ne s’achètent pas ici. Ce bouton vous redirige vers Shotgun pour payer votre place.
            </p>
            <PillLink href={event?.ticketsUrl || "#"} target="_blank" rel="noopener noreferrer" size="lg" className="mt-3 inline-flex items-center gap-2">
              Acheter sur Shotgun
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </PillLink>
          </div>
        </aside>

        {/* Description dessous (vertical) */}
        <article className="mt-6 md:mt-8 max-w-3xl mx-auto rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-5 md:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          <h2 className="sr-only">Description</h2>
          {(() => {
            const text = event?.description || "";
            const isLong = text.length > 140;
            return (
              <div>
                <p className={"text-[15px] leading-7 text-slate-800 dark:text-white/85 whitespace-pre-line " + (!showFullDesc ? "line-clamp-4" : "")}>{text}</p>
                {isLong && (
                  <button
                    type="button"
                    onClick={() => setShowFullDesc((v) => !v)}
                    className="mt-2 text-sm font-semibold text-slate-900 dark:text-white underline underline-offset-2"
                  >
                    {showFullDesc ? "Voir moins" : "Voir plus"}
                  </button>
                )}
              </div>
            );
          })()}
        </article>
      </section>
    </main>
  );
}

// No modal host needed
