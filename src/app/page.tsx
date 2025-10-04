"use client";
import React from "react";
import FeaturedSlider from "@/components/FeaturedSlider";
import { events, type Event as EventItem, eventSlug } from "@/data/events";
import EventGrid from "@/components/EventGrid";
import { useAuth } from "@/lib/auth";
import { PillLink, GlassCard } from "@/components/ui";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmtLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Group = { label: string; items: EventItem[] };
// Accepte un mapping eventSlug -> groupes dynamiques
function groupEventsByDate(evts: EventItem[], groupsByEvent: Record<string, any[]> = {}): Group[] {
  const todaySod = startOfDay(new Date());
  const tomorrowSod = startOfDay(new Date(todaySod.getTime() + 86400000));

  const todayItems: EventItem[] = [];
  const tomorrowItems: EventItem[] = [];
  const others: Map<number, EventItem[]> = new Map();

  for (const e of evts) {
    const d = startOfDay(new Date(e.startAt));
    const slug = eventSlug(e);
    const realGroups = groupsByEvent[slug] || [];
    const eventWithGroups = { ...e, groupsGoing: realGroups };
    if (d.getTime() === todaySod.getTime()) {
      todayItems.push(eventWithGroups);
    } else if (d.getTime() === tomorrowSod.getTime()) {
      tomorrowItems.push(eventWithGroups);
    } else {
      const key = d.getTime();
      const arr = others.get(key) ?? [];
      arr.push(eventWithGroups);
      others.set(key, arr);
    }
  }

  const groups: Group[] = [];
  if (todayItems.length) groups.push({ label: "Aujourd'hui", items: todayItems });
  if (tomorrowItems.length) groups.push({ label: "Demain", items: tomorrowItems });
  const sorted = [...others.entries()].sort((a, b) => a[0] - b[0]);
  for (const [time, items] of sorted) {
    const label = capitalize(fmtLong.format(new Date(time)));
    groups.push({ label, items });
  }
  return groups;
}

export default function Home() {
  const { loading } = useAuth();
  const [groupsByEvent, setGroupsByEvent] = React.useState<Record<string, any[]>>({});
  const [fetching, setFetching] = React.useState(true);
  // Toujours appeler tous les hooks en haut du composant !
  const [openConcept, setOpenConcept] = React.useState(false);

  React.useEffect(() => {
    async function fetchGroups() {
      setFetching(true);
      try {
        const res = await fetch("/api/groups");
        const allGroups = await res.json();
        // Regrouper les groupes par eventSlug
        const byEvent: Record<string, any[]> = {};
        for (const g of allGroups) {
          if (!byEvent[g.eventSlug]) byEvent[g.eventSlug] = [];
          byEvent[g.eventSlug].push(g);
        }
        setGroupsByEvent(byEvent);
      } catch (e) {
        setGroupsByEvent({});
      } finally {
        setFetching(false);
      }
    }
    fetchGroups();
  }, []);

  if (loading || fetching) {
    return (
      <main className="relative min-h-dvh">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative z-10 min-h-dvh grid place-items-center px-4">
          <div className="w-16 h-16 rounded-full border-4 border-white/30 border-t-white/90 animate-spin" aria-label="Chargement" />
        </div>
      </main>
    );
  }

  // Sélection des événements à la une: priorité aux `featured`, sinon les plus proches dans le temps
  const featuredSource = events.filter((e) => (e as unknown as { featured?: boolean }).featured) as EventItem[];
  const sortedByStart = [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const featuredEvents = (featuredSource.length ? featuredSource : sortedByStart).slice(0, 6);
  const featuredItems = featuredEvents.map((e) => ({
    id: eventSlug(e),
    title: e.title,
    date: new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(e.startAt)),
    location: `${e.venue} • ${e.city}`,
    imageUrl: e.imageUrl,
    href: `/events/${eventSlug(e)}`,
  }));

  const groups = groupEventsByDate(events, groupsByEvent);
  const todayGroup = groups.find((g) => g.label === "Aujourd'hui");

  return (
  <main className="min-h-dvh md:pt-24">
      {/* Hero psychologique, aligné à gauche sur mobile */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-6 md:pt-2">
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Sortez sans pression.
          </h1>
          <p className="mt-2 text-white/90 text-[15px] leading-7">
            Ici, on organise et on se retrouve dans une ambiance bienveillante. Discret, clair, et sans prise de tête :
            choisissez un évènement, créez votre groupe ou rejoignez‑en un en quelques instants, puis scannez votre QR le jour J.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <PillLink
              href="#liste"
              size="lg"
              className="px-3 py-2 text-sm md:px-4 md:py-3 md:text-base"
            >
              Voir les évènements
            </PillLink>
            {todayGroup && (
              <PillLink
                href="#liste"
                variant="outline"
                size="lg"
                className="hidden sm:inline-flex px-3 py-2 text-sm md:px-4 md:py-3 md:text-base"
              >
                Aujourd’hui ({todayGroup.items.length})
              </PillLink>
            )}
          </div>
          {/* Cues de confiance */}
          <ul className="mt-4 flex flex-wrap gap-2 text-xs text-white/80">
            <li className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 backdrop-blur">
              <span>🔒</span> Paiement sécurisé
            </li>
            <li className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 backdrop-blur">
              <span>⚡</span> Rapide et simple
            </li>
            <li className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 backdrop-blur">
              <span>💬</span> Ambiance bienveillante
            </li>
          </ul>
        </div>
      </section>

      {/* Tendances / A la une */}
      <section aria-labelledby="tendances" className="w-full mt-6">
        <div className="max-w-6xl mx-auto px-0 md:px-8">
          <div className="px-4 md:px-0 flex items-end justify-between">
            <div>
              <h2 id="tendances" className="text-lg md:text-xl font-extrabold text-white">Tendances cette semaine</h2>
              <p className="text-sm text-white/80">Des évènements qui partent vite — réservez votre place maintenant.</p>
            </div>
            <div className="hidden sm:block text-xs text-white/60">Glissez pour parcourir</div>
          </div>
          <div className="mt-3">
            <FeaturedSlider items={featuredItems} />
          </div>
        </div>
      </section>

      {/* Bandeau nudge vers la liste */}
      <section className="mt-4 px-4 md:px-8">
        <GlassCard className="max-w-6xl mx-auto p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-white">
              {todayGroup ? (
                <>
                  Aujourd’hui: <strong>{todayGroup.items.length}</strong> évènement{todayGroup.items.length > 1 ? "s" : ""} près de vous.
                </>
              ) : (
                <>De nouveaux évènements arrivent chaque semaine.</>
              )}
            </div>
            <PillLink href="#liste" size="sm" className="shrink-0">Parcourir la liste</PillLink>
          </div>
        </GlassCard>
      </section>

      {/* Liste principale */}
  <section id="liste" className="w-full mt-2 scroll-target">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <h2 className="sr-only">Tous les évènements</h2>
          <EventGrid groups={groups} />
        </div>
      </section>

      {/* Concept, expliqué en douceur */}
      <section className="w-full mt-10 mb-12">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <GlassCard className="p-5 md:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.10)] bg-transparent">
            <div className="flex items-start gap-3">
              <div className="hidden sm:block w-8 h-8 rounded-full bg-gradient-to-br from-pink-300/70 to-purple-300/60 dark:from-white/15 dark:to-white/5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-base md:text-lg font-extrabold text-white mb-1">Le concept, en douceur</h2>
                <p className="text-sm text-white/90">
                  Créez un groupe pour votre soirée, ou rejoignez‑en un instantanément. L’organisation est simple, bienveillante et sécurisée.
                </p>
                <ul className="mt-3 text-sm text-white/80 space-y-1.5">
                  <li>• Vous choisissez l’évènement et créez votre groupe si vous le souhaitez.</li>
                  <li>• Des participants peuvent vous rejoindre — tout est géré de façon claire et sécurisée.</li>
                  <li>• Une fois entré·e, chacun·e profite de sa soirée librement, sans contrainte.</li>
                </ul>

                <button
                  type="button"
                  onClick={() => setOpenConcept((v) => !v)}
                  className="mt-3 text-sm font-semibold text-white underline underline-offset-2"
                  aria-expanded={openConcept}
                >
                  {openConcept ? "Réduire" : "En savoir plus"}
                </button>

                {openConcept && (
                  <div className="mt-2 text-sm text-white/90">
                    Ici, l’objectif est d’aider des personnes à entrer en soirée facilement et en toute sécurité.
                    Si vous êtes organisatrice, vous pouvez accueillir des participants et tout se fait de manière cadrée et sereine.
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
    </main>
  );
}
