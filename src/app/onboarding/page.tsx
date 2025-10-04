"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function OnboardingPage() {
  const router = useRouter();
  const { setUser, login, isAuthenticated } = useAuth();
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Charger pending user
  const pending = useMemo(() => {
    try {
      const rawPending = localStorage.getItem("auth:pendingUser");
      if (rawPending) return JSON.parse(rawPending) as { name: string; email?: string };
      const rawUser = localStorage.getItem("auth:user");
      if (rawUser) {
        const u = JSON.parse(rawUser) as { name: string; email?: string; gender?: string; avatarUrl?: string };
        if (!u.gender) return { name: u.name, email: u.email };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    // Si déjà connecté ET déjà un genre, retourner à l’accueil, sinon rester pour compléter
    try {
      const rawUser = localStorage.getItem("auth:user");
      const hasGender = rawUser ? Boolean((JSON.parse(rawUser) as any)?.gender) : false;
      if (isAuthenticated && hasGender) router.replace("/");
    } catch {
      if (isAuthenticated) router.replace("/");
    }
  }, [isAuthenticated, router]);

  const onSelectFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Veuillez choisir une image valide");
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pending) return setError("Session expirée. Veuillez recommencer.");
    if (!gender) return setError("Sélectionnez un genre");
    if (!avatarUrl) return setError("Photo de profil obligatoire");

    // Enregistrer l'utilisateur en base Prisma via l'API
    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pending.name,
          email: pending.email,
          gender,
          avatarUrl,
        }),
      });
    } catch {}

    // Finaliser la création/mise à jour de compte local
    const existingRaw = localStorage.getItem("auth:user");
    if (existingRaw) {
      const cur = JSON.parse(existingRaw);
      const next = { ...cur, name: pending.name || cur.name, email: pending.email || cur.email, avatarUrl, gender, pendingBalanceCents: cur.pendingBalanceCents ?? 0, balanceCents: cur.balanceCents ?? 0 };
      setUser(next);
      try {
        const emailLower = String(next.email || "").toLowerCase();
        if (emailLower) localStorage.setItem(`auth:users:${emailLower}`, JSON.stringify(next));
      } catch {}
      localStorage.removeItem("auth:pendingUser");
      router.replace("/profile?created=1");
    } else {
      const newUser = {
        name: pending.name,
        email: pending.email,
        avatarUrl,
        gender,
        balanceCents: 0,
        pendingBalanceCents: 0,
      };
      setUser(newUser);
      try {
        const emailLower = String(newUser.email || "").toLowerCase();
        if (emailLower) localStorage.setItem(`auth:users:${emailLower}`, JSON.stringify(newUser));
      } catch {}
      login();
      localStorage.removeItem("auth:pendingUser");
      router.replace("/profile?created=1");
    }
  };

  if (!pending) {
    return (
      <main className="w-full max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow">
      <h1 className="text-xl font-extrabold text-white mb-2">Onboarding</h1>
      <p className="text-white/80">Session expirée. Veuillez recommencer l’inscription.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-md mx-auto px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center shadow">
          <span className="text-2xl">✨</span>
        </div>
  <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white">Bienvenue {pending.name}</h1>
  <p className="text-white/80">Un dernier détail pour terminer</p>
      </div>

      <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
        <form onSubmit={submit} className="space-y-5">
          <fieldset>
            <legend className="text-sm text-slate-700 dark:text-slate-300 mb-2">Genre</legend>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setGender("male")} className={`rounded-xl px-4 py-3 font-semibold border ${gender === "male" ? "border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border-white/15 bg-white/5"}`}>Homme</button>
              <button type="button" onClick={() => setGender("female")} className={`rounded-xl px-4 py-3 font-semibold border ${gender === "female" ? "border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border-white/15 bg-white/5"}`}>Femme</button>
            </div>
          </fieldset>

          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300 mb-2 block">Photo de profil (obligatoire)</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)} />
            <label onClick={() => fileInputRef.current?.click()} className="block rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-4 cursor-pointer">
              {avatarUrl ? (
                <div className="flex items-center gap-3">
                  <img src={avatarUrl} alt="Aperçu" className="w-14 h-14 rounded-full object-cover" />
                  <div className="text-sm text-slate-700 dark:text-slate-300">Changer la photo</div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-28 text-slate-600 dark:text-slate-300">Clique pour importer une photo</div>
              )}
            </label>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button type="submit" className="w-full rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow hover:opacity-90">Terminer</button>
        </form>
      </div>
    </main>
  );
}
