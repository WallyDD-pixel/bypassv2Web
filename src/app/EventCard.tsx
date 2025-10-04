"use client";
import React from "react";
import Link from "next/link";
import { slugify } from "@/lib/slugify";

interface EventCardProps {
  title: string;
  startAt: string; // ISO
  venue: string;
  city: string;
  imageUrl: string;
  avatars?: string[]; // avatars des créateurs de groupes (owners)
}

const EventCard: React.FC<EventCardProps> = ({ title, startAt, venue, city, imageUrl, avatars = [] }) => {
  const d = new Date(startAt);
  const dayNum = d.toLocaleDateString("fr-FR", { day: "2-digit" });
  const month = d.toLocaleDateString("fr-FR", { month: "short" }).toUpperCase();
  const fullDate = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  // Include date in slug to reduce collisions for events with same title
  const slug = slugify(`${title}-${startAt.slice(0, 10)}`);

  // Calcul des tailles des bulles en fonction du total d'avatars
  const totalAvatars = avatars.length;
  const shownAvatars = Math.min(4, totalAvatars);
  const { sizeClass, overlapClass } = React.useMemo(() => {
    if (totalAvatars <= 1) return { sizeClass: "w-11 h-11", overlapClass: "-space-x-3" };
    if (totalAvatars === 2) return { sizeClass: "w-10 h-10", overlapClass: "-space-x-3" };
    if (totalAvatars === 3) return { sizeClass: "w-9 h-9", overlapClass: "-space-x-2" };
    if (totalAvatars === 4) return { sizeClass: "w-8 h-8", overlapClass: "-space-x-2" };
    if (totalAvatars <= 8) return { sizeClass: "w-7 h-7", overlapClass: "-space-x-1" };
    return { sizeClass: "w-6 h-6", overlapClass: "-space-x-1" };
  }, [totalAvatars]);

  return (
      <Link
      href={`/events/${slug}`}
      aria-label={`Voir l’événement ${title}`}
      title={title}
        className="group relative rounded-2xl overflow-hidden max-w-[520px] w-full m-4 flex flex-col border border-white/15 bg-white/5 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.14)] transform-gpu transition-all duration-300 ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-1 hover:shadow-[0_16px_60px_rgba(0,0,0,0.25)] hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20"
      >
      {/* inner highlight for depth */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" />
      <div className="relative">
        <img src={imageUrl} alt={title} className="w-full h-[200px] object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.03]" />
        {/* Date badge */}
        <div className="absolute top-3 left-3 backdrop-blur-2xl bg-black/30 border border-white/40 dark:border-white/20 text-white rounded-xl px-3 py-2 leading-none shadow">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold drop-shadow">{dayNum}</span>
            <span className="text-xs font-semibold tracking-wide">{month}</span>
          </div>
        </div>
        {/* subtle bottom gradient to anchor content */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>
      <div className="p-5 min-h-[168px]">
        <h3 className="text-xl font-extrabold mb-1 text-black dark:text-white line-clamp-2">
          {title}
        </h3>
        <div className="text-neutral-800 dark:text-neutral-200 text-sm mb-2">
          {fullDate}
        </div>
        <div className="text-neutral-800 dark:text-neutral-200 text-sm mb-3">
          <span className="font-semibold">{venue}</span>
          <span className="mx-1">•</span>
          <span>{city}</span>
        </div>
        {/* Avatars des créateurs de groupes — conteneur à hauteur fixe pour conserver une carte de taille constante */}
        <div className="flex items-center h-11">
          {totalAvatars > 0 ? (
            <>
              <div className={`flex ${overlapClass}`}>
                {avatars.slice(0, shownAvatars).map((src, i) => (
                  <img
                    key={`${title}-av-${i}`}
                    src={src}
                    alt=""
                    className={`${sizeClass} rounded-full ring-2 ring-white/80 dark:ring-black/40 object-cover`}
                    loading="lazy"
                  />
                ))}
              </div>
              {totalAvatars > shownAvatars && (
                <div className="flex items-center ml-2" aria-hidden>
                  <div
                    className={`${sizeClass} rounded-full ring-2 ring-white/80 dark:ring-black/40 bg-slate-800 text-white text-xs font-semibold grid place-items-center`}
                  >
                    {totalAvatars - shownAvatars}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-neutral-600 dark:text-neutral-400 select-none" aria-live="polite">
              Aucun groupe pour cet événement pour l'instant.
            </div>
          )}
        </div>
      </div>
  </Link>
  );
};

export default EventCard;
