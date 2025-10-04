"use client";
import React from "react";
import { useAuth } from "@/lib/auth";
import EventCard from "@/app/EventCard";
import EventCardSkeleton from "@/components/skeletons/EventCardSkeleton";
import type { Event as EventItem } from "@/data/events";
import { PillButton } from "@/components/ui";

type Props = { groups: { label: string; items: EventItem[] }[] };

export default function EventGrid({ groups }: Props) {
  const { loading } = useAuth();
  // Afficher seulement Aujourd'hui, Demain et Après-demain au premier rendu
  const initialCount = React.useMemo(() => Math.min(groups.length, 3), [groups.length]);
  const [expanded, setExpanded] = React.useState(false); // Jours
  const visible = expanded ? groups : groups.slice(0, initialCount);

  // Limite d'événements par jour (pour éviter de trop défiler)
  const perGroupLimit = 3;
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(() => new Set());
  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {visible.map((group, i, arr) => {
        const isOpen = expandedGroups.has(group.label);
        const itemsToShow = isOpen ? group.items : group.items.slice(0, perGroupLimit);
        const canExpandGroup = group.items.length > perGroupLimit;
        return (
        <div key={group.label}>
          <h2 className="uppercase tracking-[0.22em] text-base sm:text-lg font-extrabold text-white mb-4">
            {group.label}
          </h2>
          <div className="flex flex-wrap justify-center sm:justify-start -m-4">
            {loading
              ? Array.from({ length: Math.max(3, Math.min(perGroupLimit, group.items.length || perGroupLimit)) }).map((_, idx) => (
                  <EventCardSkeleton key={`s-${idx}`} />
                ))
              : itemsToShow.map((event, idx) => {
                  const avatars = (event.groupsGoing || []).map(g => g.avatarUrl).filter(Boolean) as string[];
                  return (
                  <EventCard
                    key={`${group.label}-${idx}`}
                    title={event.title}
                    startAt={event.startAt}
                    venue={event.venue}
                    city={event.city}
                    imageUrl={event.imageUrl}
                    avatars={avatars}
                  />
                );
                })}
          </div>
          {canExpandGroup && (
            <div className="flex justify-center mt-4">
              {!isOpen ? (
                <PillButton variant="ghost" onClick={() => toggleGroup(group.label)}>
                  Voir plus
                </PillButton>
              ) : (
                <PillButton variant="ghost" onClick={() => toggleGroup(group.label)}>
                  Voir moins
                </PillButton>
              )}
            </div>
          )}
          {i < arr.length - 1 && (
            <div className="flex justify-center mt-6">
              <div
                role="separator"
                aria-hidden
                className="h-px w-24 sm:w-32 bg-gradient-to-r from-transparent via-slate-400/40 to-transparent"
              />
            </div>
          )}
        </div>
      );})}

      {/* Voir plus / Voir moins */}
      {groups.length > initialCount && (
        <div className="flex justify-center">
          {!expanded ? (
            <PillButton variant="outline" onClick={() => setExpanded(true)}>Voir plus</PillButton>
          ) : (
            <PillButton variant="ghost" onClick={() => setExpanded(false)}>Voir moins</PillButton>
          )}
        </div>
      )}
    </div>
  );
}
