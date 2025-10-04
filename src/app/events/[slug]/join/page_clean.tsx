"use client";
import React, { useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Dialog } from '@headlessui/react';
import Link from "next/link";
import { getEventBySlug } from "@/data/events";
import type { Group } from "@/data/events";
import { useAuth } from "@/lib/auth";

export default function JoinGroupPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = getEventBySlug(slug || "");
  const searchParams = useSearchParams();
  const status = (searchParams?.get("status") as string) || "";
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();

  // États
  const [mode, setMode] = useState<'list' | 'wizard'>("list");
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [showGratuitInfo, setShowGratuitInfo] = useState(false);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [fetchingGroups, setFetchingGroups] = useState(true);

  // Fetch groups
  useEffect(() => {
    if (!slug) return;
    setFetchingGroups(true);
    fetch(`/api/groups?slug=${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => setAllGroups(data || []))
      .catch(() => setAllGroups([]))
      .finally(() => setFetchingGroups(false));
  }, [slug]);

  // Join requests
  const userEmailLower = user?.email ? user.email.toLowerCase() : undefined;
  type JoinRequest = { groupName: string; eventSlug: string; status?: string };
  const [requested, setRequested] = useState<JoinRequest[]>([]);

  useEffect(() => {
    if (!userEmailLower || !slug) return;
    const load = async () => {
      const key = `joinRequests:${slug}:${userEmailLower}`;
      try {
        const res = await fetch(`/api/requests?memberEmail=${encodeURIComponent(userEmailLower)}&eventSlug=${encodeURIComponent(String(slug))}`, { cache: "no-store" });
        if (res.ok) {
          const apiData = await res.json();
          const listFromApi: JoinRequest[] = Array.isArray(apiData)
            ? apiData.map((r: any) => ({ groupName: r.groupName, eventSlug: r.eventSlug, status: r.status }))
            : [];
          setRequested(listFromApi);
          return;
        }
      } catch {
        // Fallback localStorage
      }
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
        if (raw) {
          const arr = JSON.parse(raw) as Array<string | { group: string; amount?: number; currency?: string; status?: string; createdAt?: string; method?: string }>;
          const localList: JoinRequest[] = arr.map((x) =>
            typeof x === 'string'
              ? { groupName: x, eventSlug: String(slug), status: 'pending' }
              : { groupName: x.group, eventSlug: String(slug), status: (x.status as string) || 'pending' }
          );
          setRequested(localList);
        } else {
          setRequested([]);
        }
      } catch {
        setRequested([]);
      }
    };
    load();
  }, [userEmailLower, slug]);

  const isMale = user?.gender === 'male';

  if (!event) return notFound();
  if (fetchingGroups) {
    return (
      <main className="relative min-h-dvh">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative z-10 min-h-dvh grid place-items-center px-4">
          <div className="w-16 h-16 rounded-full border-4 border-white/30 border-t-white/90 animate-spin" aria-label="Chargement" />
        </div>
      </main>
    );
  }

  const renderGroupList = () => {
    if (allGroups.length === 0) {
      return (
        <div className="text-center text-slate-500 py-12">
          <div className="text-2xl mb-2">😶‍🌫️</div>
          <div>Aucun groupe n'est encore disponible pour cet évènement.<br/>Créez le premier groupe ou revenez plus tard !</div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {allGroups.map((g, idx) => {
          const alreadyRequested = requested.some(r => r.groupName === g.name && r.eventSlug === slug && (r.status === 'pending' || r.status === 'accepted'));
          const avatars = (g.memberAvatars && g.memberAvatars.length > 0) ? g.memberAvatars : (g.avatarUrl ? [g.avatarUrl] : []);
          const maleSpots = Math.max(0, (g.femaleCount || 0) - (g.maleCount || 0));

          return (
            <div key={g.name || idx} className="group w-full rounded-2xl border border-white/15 bg-white/90 shadow hover:shadow-xl transition overflow-hidden flex flex-col items-center p-6 relative">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-300 mb-3 ring-2 ring-primary-500">
                <img src={avatars[0] || "/api/placeholder/64/64"} alt={`Avatar ${g.name}`} className="w-full h-full object-cover" />
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-1 text-center">{g.name}</h3>
              
              <div className="text-sm text-slate-600 mb-3 text-center">
                {g.femaleCount || 0} filles • {g.maleCount || 0} garçons
                {g.arrivalTime && <div className="mt-1">Arrivée: {g.arrivalTime}</div>}
              </div>

              {!isMale ? (
                <div className="w-full">
                  <button
                    onClick={() => setShowGratuitInfo(true)}
                    className="w-full px-4 py-2 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 transition"
                  >
                    Rejoindre (Gratuit) 🎀
                  </button>
                </div>
              ) : (
                <div className="w-full space-y-2">
                  {maleSpots > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] bg-emerald-100 text-emerald-900 border border-emerald-300">
                      Places hommes restantes: {maleSpots}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] bg-white text-slate-900 border border-slate-500/30">
                      Complet pour hommes
                    </span>
                  )}
                  
                  {alreadyRequested ? (
                    <button className="w-full px-4 py-2 rounded-xl bg-slate-400 text-white font-semibold cursor-not-allowed">
                      Demande envoyée ⏳
                    </button>
                  ) : (
                    <button
                      disabled={maleSpots === 0}
                      onClick={() => {
                        setActiveGroup(g);
                        setMode("wizard");
                        setWizardStep(0);
                        setSelectedAmount(g.pricePerMale || 0);
                      }}
                      className="w-full px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {g.pricePerMale ? `Rejoindre (${g.pricePerMale}€)` : 'Rejoindre'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderWizard = () => {
    if (!activeGroup) return null;

    const maleSpots = Math.max(0, (activeGroup.femaleCount || 0) - (activeGroup.maleCount || 0));
    const basePrice = activeGroup.pricePerMale || 0;
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

    if (wizardStep === 0) {
      return (
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Rejoindre le groupe "{activeGroup.name}"</h2>
          
          <div className="rounded-xl border border-white/15 bg-white/70 p-4 space-y-2 text-sm text-slate-700 mb-4">
            <div>Groupe: {activeGroup.name}</div>
            <div>Prix de base: {fmt(basePrice)}</div>
            <div>Places hommes restantes: {maleSpots}</div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setMode("list");
                setActiveGroup(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-900 font-semibold"
            >
              Annuler
            </button>
            <button
              onClick={() => setWizardStep(1)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold"
            >
              Continuer
            </button>
          </div>
        </div>
      );
    }

    if (wizardStep === 1) {
      return (
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Montant à payer</h2>
          
          <div className="rounded-xl border border-white/15 bg-white/70 p-4 mb-4">
            <div className="text-center mb-4">
              <div className="text-3xl font-bold text-slate-900">{fmt(selectedAmount)}</div>
              <div className="text-sm text-slate-600">Montant que vous paierez</div>
            </div>
            
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedAmount(Math.max(basePrice, selectedAmount - 5))}
                className="h-10 px-3 grid place-items-center rounded-xl bg-white text-slate-900 border border-white/15 text-sm font-semibold"
              >
                -5
              </button>
              <button
                type="button"
                onClick={() => setSelectedAmount(selectedAmount + 5)}
                className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold"
              >
                +5
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setWizardStep(0)}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-900 font-semibold"
            >
              Retour
            </button>
            <button
              onClick={() => setWizardStep(2)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold"
            >
              Suivant
            </button>
          </div>
        </div>
      );
    }

    if (wizardStep === 2) {
      return (
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Confirmation</h2>
          
          <div className="rounded-xl border border-white/15 bg-white/70 p-4 space-y-2 text-sm text-slate-700 mb-4">
            <div>Groupe: {activeGroup.name}</div>
            <div>Montant: {fmt(selectedAmount)}</div>
            <div>Places hommes restantes: {maleSpots}</div>
          </div>

          <div className="mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={acceptCGU} 
                onChange={(e) => setAcceptCGU(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-slate-700">
                J'accepte les conditions et je confirme ma demande pour ce groupe.
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setWizardStep(1)}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-900 font-semibold"
            >
              Retour
            </button>
            <button
              disabled={!acceptCGU || maleSpots === 0}
              onClick={() => {
                const key = encodeURIComponent(activeGroup.name);
                const amt = Math.max(0, selectedAmount);
                router.push(`/events/${slug}/join/pay?g=${key}&amt=${amt}`);
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-50"
            >
              Continuer vers le paiement
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Dialog explicatif pour "Gratuit" */}
      <Dialog open={showGratuitInfo} onClose={() => setShowGratuitInfo(false)} className="fixed z-50 inset-0 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" onClick={() => setShowGratuitInfo(false)} />
        <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full mx-auto shadow-xl z-10">
          <Dialog.Title className="text-lg font-bold mb-2 text-slate-900">C'est gratuit pour les filles ?</Dialog.Title>
          <Dialog.Description className="text-slate-700 mb-4">
            <ul className="list-disc pl-5 space-y-1">
              <li>Les femmes ne paient jamais pour rejoindre un groupe.</li>
              <li>Cela vise à favoriser la mixité et l'équilibre dans les groupes.</li>
              <li>Le paiement des hommes sert uniquement à entrer avec le groupe, aucun droit n'est acquis sur quiconque.</li>
            </ul>
          </Dialog.Description>
          <button onClick={() => setShowGratuitInfo(false)} className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold">
            Fermer
          </button>
        </div>
      </Dialog>

      <main className="max-w-6xl mx-auto px-6 py-14">
        {status === "success" && (
          <div className="mb-4 rounded-md border border-green-700/50 bg-green-900/20 text-green-200 px-3 py-2">
            Paiement confirmé ✔ — votre demande a bien été envoyée au groupe.
          </div>
        )}
        {status === "failed" && (
          <div className="mb-4 rounded-md border border-red-700/50 bg-red-900/20 text-red-200 px-3 py-2">
            Paiement refusé ✖ — aucune somme n'a été débitée. Vous pouvez réessayer.
          </div>
        )}

        <div className="mb-10 flex items-center gap-3">
          <h1 className="hidden md:block text-3xl font-extrabold text-slate-900 tracking-tight">
            Rejoindre un groupe
          </h1>
        </div>

        <div className="grid md:grid-cols-[1fr_370px] gap-12 items-start min-h-[60vh]">
          <div className="w-full">
            {mode === "list" && renderGroupList()}
            {mode === "wizard" && renderWizard()}
          </div>
          
          <aside className="hidden md:block rounded-2xl border border-white/15 bg-white/80 backdrop-blur-xl p-8 shadow-[0_12px_40px_rgba(0,0,0,0.14)] sticky top-24 min-w-[370px] max-w-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-8 w-8 rounded-full bg-slate-900 text-white grid place-items-center shadow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3 11v2m0-2a9 9 0 0 1 9-9v0v20a9 9 0 0 1-9-9Zm9-9c3.771 0 7.108 2.087 8.822 5.196A2 2 0 0 1 21 9v6a2 2 0 0 1-.178.804C19.108 18.913 15.771 21 12 21V2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <div>
                <div className="text-sm font-extrabold text-slate-900 mb-2">
                  Règles importantes
                </div>
                <ul className="mt-2 space-y-2 text-[13px] text-slate-700 list-disc pl-4">
                  <li>Respect, consentement et bienveillance à tout moment.</li>
                  <li>Les femmes ne paient pas pour rejoindre un groupe.</li>
                  <li>Le paiement des hommes sert uniquement à entrer avec le groupe; aucun droit n'est acquis sur quiconque.</li>
                  <li>Un groupe peut refuser une demande si les conditions ne sont pas respectées.</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
