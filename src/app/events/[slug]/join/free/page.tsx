"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getEventBySlug } from "@/data/events";
import type { Group } from "@/data/events";
import { useAuth } from "@/lib/auth";

export default function FreeJoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = getEventBySlug(slug || "");
  const router = useRouter();
  const search = useSearchParams();
  const { isAuthenticated, user, loading } = useAuth();
  const [sending, setSending] = useState(false);

  const groupName = decodeURIComponent(search.get("g") || "");

  // Mobile header title
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "Demande gratuite" }));
    }
    return () => {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "" }));
    };
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

  const storageKeyGroupsLegacy = (slug: string) => `createdGroups:${slug}`;
  const storageKeyGroupsScoped = (slug: string, emailLower?: string) => `createdGroups:${slug}${emailLower ? ":" + emailLower : ""}`;
  const [persistedGroups, setPersistedGroups] = useState<Group[]>([]);
  useEffect(() => {
    try {
      const emailLower = (user?.email || "").toLowerCase();
      let merged: any[] = [];
      if (typeof window !== "undefined") {
        const scoped = window.localStorage.getItem(storageKeyGroupsScoped(slug || "", emailLower || undefined));
        const legacy = window.localStorage.getItem(storageKeyGroupsLegacy(slug || ""));
        if (scoped) merged = merged.concat(JSON.parse(scoped));
        if (legacy) {
          const arr = JSON.parse(legacy) as any[];
          const mine = arr.filter((g: any) => (g?.ownerEmail || "").toLowerCase() === emailLower || (user?.name && g?.name === `Groupe de ${user?.name}`));
          merged = merged.concat(mine);
        }
      }
      setPersistedGroups(merged);
    } catch {
      setPersistedGroups([]);
    }
  }, [slug, user?.email, user?.name]);

  const allGroups = useMemo(() => {
    if (!event) return [] as Group[];
    return [...event.groupsGoing, ...persistedGroups];
  }, [event, persistedGroups]);

  const group = allGroups.find((g) => g.name === groupName) || null;

  useEffect(() => {
    if (!event) router.replace("/");
    if (!groupName) router.replace(`/events/${slug}/join`);
  }, [event, groupName, router, slug]);

  if (loading || !isAuthenticated || !user || !event || !group) return null;

  const userEmailLower = (user?.email || "").toLowerCase();
  const storageKeyRequests = (slug: string, email: string) => `joinRequests:${slug}:${email}`;

  const persistRequest = async () => {
    try {
      // Crée aussi côté serveur pour éviter les doublons et activer le temps réel
      try {
        await fetch(`/api/requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug: slug,
            groupName: group.name,
            memberEmail: userEmailLower,
            amountCents: null,
            currency: null,
            method: "free",
            status: "pending",
          }),
        });
      } catch {}
      // Toujours aussi stocker localement pour l'UX offline
      const key = storageKeyRequests(slug || "", userEmailLower);
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      const arr = raw ? (JSON.parse(raw) as Array<string | { group: string; status?: string }>) : [];
      const exists = arr.some((x) => (typeof x === 'string' ? x === group.name : x.group === group.name));
      if (!exists) {
        arr.push({ group: group.name, status: 'pending' });
        window.localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch {}
  };

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="hidden md:block text-2xl font-extrabold text-slate-900 dark:text-white">Demande gratuite</h1>
      </div>

      <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
        <div className="mb-4">
          <div className="text-sm text-slate-600 dark:text-slate-300">Vous demandez à rejoindre</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{group.name}</div>
        </div>

        <div className="mt-2 rounded-xl border border-emerald-300/60 dark:border-emerald-400/30 bg-emerald-50/80 dark:bg-emerald-500/10 p-4">
          <div className="text-sm text-emerald-900 dark:text-emerald-100">
            <div className="font-semibold mb-0.5">Demande pour les femmes</div>
            <p>Les femmes peuvent demander à rejoindre un groupe gratuitement. Votre demande sera envoyée au groupe pour validation.</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={() => router.back()} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white">Annuler</button>
          <button
            disabled={sending}
            onClick={async () => {
              setSending(true);
              await persistRequest();
              router.push(`/events/${slug}/join?status=success`);
            }}
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-50"
          >
            {sending ? "Envoi…" : "Envoyer la demande gratuite"}
          </button>
        </div>
      </div>
    </main>
  );
}
