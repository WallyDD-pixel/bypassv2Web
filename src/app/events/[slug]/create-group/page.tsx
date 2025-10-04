"use client";
import React, { useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { getEventBySlug } from "@/data/events";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { GROUP_CREATOR_GENDER } from "@/config/policies";
import { motion, AnimatePresence } from "framer-motion";

export default function CreateGroupPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = getEventBySlug(slug || "");
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();
  const canCreate = isAuthenticated && (user?.gender || "").toLowerCase() === GROUP_CREATOR_GENDER;

  if (!event) return notFound();
  // Mobile header title
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "Créer un groupe" }));
    }
    return () => {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "" }));
    };
  }, []);

  // Simple gate
  if (!loading && !isAuthenticated) {
    router.replace("/login");
    return null;
  }
  if (!loading && !canCreate) {
    router.replace(`/events/${slug}`);
    return null;
  }

  // Helpers for time handling
  const eventStart = useMemo(() => new Date(event.startAt), [event.startAt]);
  const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  // Wizard state
  const [step, setStep] = useState(0); // 0: parité, 1: heure, 2: prix, 3: récap/CGU
  // Parité: nb femmes = nb hommes autorisés
  const [femaleCount, setFemaleCount] = useState(1);
  const maleAllowed = femaleCount; // 1:1 parity
  const [arrivalTime, setArrivalTime] = useState<string>(toHHMM(eventStart));
  const [pricePerMale, setPricePerMale] = useState<number | "">("");
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // local persistence key (fallback offline)
  const storageKey = (slug: string, emailLower?: string) => `createdGroups:${slug}${emailLower ? ":" + emailLower : ""}`;

  const setFromRelative = (deltaMin: number) => {
    const d = new Date(eventStart);
    d.setMinutes(d.getMinutes() + deltaMin);
    setArrivalTime(toHHMM(d));
  };
  const adjustArrival = (deltaMin: number) => {
    const [h, m] = arrivalTime.split(":").map(Number);
    const d = new Date(eventStart);
    d.setHours(h, m + deltaMin, 0, 0);
    setArrivalTime(toHHMM(d));
  };

  const isStepValid = () => {
    switch (step) {
      case 0:
        return femaleCount > 0;
      case 1:
        return Boolean(arrivalTime);
      case 2:
        return pricePerMale !== "" && (pricePerMale as number) >= 0;
      case 3:
        return acceptCGU;
      default:
        return false;
    }
  };

  const next = () => isStepValid() && setStep((s) => Math.min(3, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStepValid() || step !== 3) return;
    setSubmitting(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));

    // 1) Tenter côté serveur (visible depuis tous les appareils)
    try {
      const payload = {
        eventSlug: slug,
        name: user?.name ? `Groupe de ${user.name}` : "Nouveau groupe",
        members: femaleCount,
        maleCount: 0,
        femaleCount,
        avatarUrl: user?.avatarUrl,
        ownerEmail: user?.email,
        ownerName: user?.name,
        pricePerMale: typeof pricePerMale === "number" ? pricePerMale : null,
        arrivalTime,
      };
      await fetch("/api/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // 2) Fallback local (même appareil uniquement)
      try {
        const emailLower = (user?.email || "").toLowerCase();
        const key = storageKey(slug || "", emailLower || undefined);
        const existing = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
        const arr = existing ? (JSON.parse(existing) as any[]) : [];
        const newGroup = {
          name: user?.name ? `Groupe de ${user.name}` : "Nouveau groupe",
          members: femaleCount,
          maleCount: 0,
          femaleCount: femaleCount,
          avatarUrl: user?.avatarUrl,
          ownerEmail: user?.email,
          pricePerMale: typeof pricePerMale === "number" ? pricePerMale : undefined,
          arrivalTime: arrivalTime,
        };
        arr.push(newGroup);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(arr));
        }
      } catch {}
      console.error("Persist group error (server)", err);
    }

    setSubmitting(false);
    setSuccess(true);
  setTimeout(() => router.replace(`/events/${slug}`), 1200);
  };

  const fmtPrice = useMemo(() =>
    typeof pricePerMale === "number" ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(pricePerMale) : "—"
  , [pricePerMale]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="hidden md:block text-2xl font-extrabold text-slate-900 un groupe</h1>
        <div className="ml-auto text-sm text-slate-600 {step + 1} / 4</div>
      </div>

      <div className="grid place-items-center min-h-[60vh]">
        <div className="w-full rounded-2xl border border-white/15 bg-white/70 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
        <form onSubmit={submit} className="space-y-6">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.section
                key="step-parity"
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              >
                <h2 className="text-base font-extrabold text-slate-900 mb-2 text-center">Parité</h2>
                <p className="text-sm text-slate-600 mb-5 text-center">Pour chaque fille, un garçon peut rejoindre. Indique combien vous êtes (filles).</p>
                <div className="flex flex-col items-center gap-4">
                  <label className="text-sm text-slate-700 de filles</label>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/60 backdrop-blur px-2 py-2">
                    <button type="button" aria-label="Diminuer" onClick={() => setFemaleCount((c) => Math.max(1, c - 1))} className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold select-none active:scale-95 transition">−</button>
                    <div className="w-14 text-center text-lg font-semibold tabular-nums text-slate-900
                    <button type="button" aria-label="Augmenter" onClick={() => setFemaleCount((c) => c + 1)} className="h-10 w-10 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-xl font-bold select-none active:scale-95 transition">+</button>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[1,2,3,4,5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFemaleCount(n)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition ${femaleCount === n ? 'bg-slate-900 text-white border-white/15 : 'bg-white/60 text-slate-700 border-white/15 hover:bg-white'}
                        `}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-slate-700 autorisés: <strong>{maleAllowed}</strong></span>
                </div>
              </motion.section>
            )}

            {step === 1 && (
              <motion.section
                key="step-arrival"
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              >
                <h2 className="text-base font-extrabold text-slate-900 mb-2 text-center">Heure d’arrivée</h2>
                <p className="text-sm text-slate-600 mb-5 text-center">Heure de début: <strong>{toHHMM(eventStart)}</strong>. Choisis ton heure d’arrivée.</p>
                <div className="flex flex-col items-center gap-4">
                  <div className="text-4xl font-bold tracking-wide tabular-nums text-slate-900
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/60 backdrop-blur px-2 py-2 text-slate-900
                  <button type="button" aria-label="-15 minutes" onClick={() => adjustArrival(-15)} className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold select-none active:scale-95 transition">−15 min</button>
                  <button type="button" aria-label="+15 minutes" onClick={() => adjustArrival(15)} className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold select-none active:scale-95 transition">+15 min</button>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                  {[
                    { label: "−60", delta: -60 },
                    { label: "−30", delta: -30 },
                    { label: "−15", delta: -15 },
                    { label: "À l’heure", delta: 0 },
                    { label: "+15", delta: 15 },
                    { label: "+30", delta: 30 },
                  ].map(({ label, delta }) => {
                    const d = new Date(eventStart);
                    d.setMinutes(d.getMinutes() + delta);
                    const hhmm = toHHMM(d);
                    const active = hhmm === arrivalTime;
                    return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setFromRelative(delta)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? 'bg-slate-900 text-white border-white/15 : 'bg-white/60 text-slate-700 border-white/15 hover:bg-white'}`}
                      title={`${hhmm}`}
                    >
                      {label}
                    </button>
                    );
                  })}
                  </div>
                  <div className="text-xs text-slate-500 saisis une heure précise</div>
                  <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/60 backdrop-blur px-2 py-2 text-slate-900 required />
                </div>
              </motion.section>
            )}

            {step === 2 && (
              <motion.section
                key="step-price"
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              >
                <h2 className="text-base font-extrabold text-slate-900 mb-2 text-center">Prix par homme</h2>
                <div className="flex flex-col items-center gap-4">
                  <div className="text-4xl font-bold tracking-wide tabular-nums text-slate-900
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/60 backdrop-blur px-2 py-2">
                    <button type="button" aria-label="-5 €" onClick={() => setPricePerMale((p) => (p === "" ? 0 : Math.max(0, (p as number) - 5)))} className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold select-none active:scale-95 transition">−5</button>
                    <button
                      type="button"
                      aria-label="-1 €"
                      onClick={() => setPricePerMale((p) => (p === "" ? 0 : Math.max(0, (p as number) - 1)))}
                      className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold select-none active:scale-95 transition"
                    >
                      −1
                    </button>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={pricePerMale === "" ? "" : pricePerMale}
                      onChange={(e) => setPricePerMale(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                      className="w-24 text-center rounded-xl border border-white/15 bg-white/60 px-3 py-2 outline-none text-black placeholder:text-black"
                    />
                    <button type="button" aria-label="+1 €" onClick={() => setPricePerMale((p) => (p === "" ? 1 : (p as number) + 1))} className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold select-none active:scale-95 transition">+1</button>
                    <button type="button" aria-label="+5 €" onClick={() => setPricePerMale((p) => (p === "" ? 5 : (p as number) + 5))} className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold select-none active:scale-95 transition">+5</button>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[0, 10, 15, 20, 25, 30].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPricePerMale(n)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition ${
                          pricePerMale === n
                            ? 'bg-slate-900 text-white border-white/15
                            : 'bg-white/90 text-slate-900 border-white/15 hover:bg-white/100
                          }`}
                        >
                          {n} €
                        </button>
                    ))}
                  </div>
                  <div className="w-full max-w-md flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={1}
                      value={pricePerMale === "" ? 0 : (pricePerMale as number)}
                      onChange={(e) => setPricePerMale(Math.max(0, Number(e.target.value)))}
                      className="w-full range"
                      style={{
                        // @ts-ignore CSS var inline style
                        "--min": 0,
                        // @ts-ignore
                        "--max": 50,
                        // @ts-ignore
                        "--value": pricePerMale === "" ? 0 : (pricePerMale as number),
                      } as React.CSSProperties}
                    />
                    <div className="text-sm w-12 text-right tabular-nums">{pricePerMale === "" ? 0 : pricePerMale}€</div>
                  </div>
                </div>
              </motion.section>
            )}

            {step === 3 && (
              <motion.section
                key="step-recap"
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              >
                <div className="rounded-xl border border-white/15 bg-white/60 p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Récap</h3>
                  <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
                    <li>{femaleCount} fille(s), {maleAllowed} garçon(s) max.</li>
                    <li>Arrivée prévue à {arrivalTime || "—"}.</li>
                    <li>Prix par homme: {fmtPrice}.</li>
                  </ul>
                </div>
                {/* Info card: comment ça marche */}
                <div className="mt-4 rounded-xl border border-white/15 bg-white/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-700 grid place-items-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3l7 4v5c0 5-3.8 8-7 9-3.2-1-7-4-7-9V7l7-4z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 ça marche ?</h4>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700
                        Le principe est simple: des groupes de filles accompagnent des groupes de garçons pour <strong>passer le videur et entrer en club</strong>. 
                        L’objectif est de <strong>faciliter l’accès</strong> à l’établissement, rien de plus.
                      </p>
                      <ul className="mt-2 text-sm text-slate-700 space-y-1">
                        <li>• Liberté totale: aucune obligation de <em>passer la soirée</em> ensemble après l’entrée.</li>
                        <li>• Aucune contrepartie attendue: <strong>respect</strong> et <strong>bienveillance</strong> avant tout.</li>
                        <li>• Vous choisissez quand et avec qui vous entrez; ensuite, chacun est libre de sa soirée.</li>
                      </ul>
                    </div>
                  </div>
                </div>
                {/* CGU checkbox fancy */}
                <div className="mt-4">
                  <label className="group flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptCGU}
                      onChange={(e) => setAcceptCGU(e.target.checked)}
                      className="sr-only"
                    />
                    <span className={`mt-0.5 h-5 w-5 rounded-md border grid place-items-center transition shadow-sm ${acceptCGU ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/70 border-white/15 text-transparent'} group-hover:shadow-md`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition ${acceptCGU ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className="text-sm text-slate-700
                      J’accepte les conditions générales d’utilisation
                      <span className="block text-xs text-slate-500 acceptant, vous confirmez avoir lu et compris le fonctionnement et les règles de respect.</span>
                    </span>
                  </label>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button type="button" onClick={back} disabled={step === 0 || submitting} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-900 disabled:opacity-50">Précédent</button>
            {step < 3 ? (
              <button type="button" onClick={next} disabled={!isStepValid()} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white disabled:opacity-50">Suivant</button>
            ) : (
              <div className="flex items-center gap-3">
                <button type="submit" disabled={!isStepValid() || submitting} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white shadow disabled:opacity-50">
                  {submitting ? "Création…" : "Créer le groupe"}
                </button>
                <AnimatePresence>
                  {success && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-sm text-emerald-600
                      ✓ Votre groupe a bien été créé
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </form>
        </div>
      </div>
    </main>
  );
}
