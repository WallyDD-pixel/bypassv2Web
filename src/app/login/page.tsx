"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard, PillButton } from "@/components/ui";
import ProfileSkeleton from "@/components/skeletons/ProfileSkeleton";

export default function LoginPage() {
  const { login, setUser, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace("/");
  }, [loading, isAuthenticated, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) return setError("Email requis");
    // Démo: on accepte n'importe quel mot de passe
    const emailLower = email.toLowerCase();
    // Si un profil existe déjà pour cet email (avec genre), restaurer et connecter directement
  try {
      const raw = localStorage.getItem(`auth:users:${emailLower}`);
      if (raw) {
        const profile = JSON.parse(raw);
        if (profile?.gender) {
          setUser(profile);
      // marquer comme connecté (login ne remplace pas auth:user si déjà présent)
      login();
      router.replace("/?logged=1");
          return;
        }
      }
    } catch {}
    // Sinon, passer par l'onboarding pour définir le genre et la photo
    const name = email.split("@")[0].replace(/\W+/g, " ").trim() || "Utilisateur";
    localStorage.setItem("auth:pendingUser", JSON.stringify({ name, email }));
    router.replace("/onboarding");
  };

  const signWith = (provider: "google" | "apple") => {
    const name = provider === "google" ? "Google User" : "Apple User";
    const email = provider === "google" ? "google.user@example.com" : "apple.user@example.com";
    const emailLower = email.toLowerCase();
    try {
      const raw = localStorage.getItem(`auth:users:${emailLower}`);
      if (raw) {
        const profile = JSON.parse(raw);
        if (profile?.gender) {
          setUser(profile);
          login();
          router.replace("/?logged=1");
          return;
        }
      }
    } catch {}
    // Social demo: si pas de profil connu, passer par l'onboarding
    localStorage.setItem("auth:pendingUser", JSON.stringify({ name, email }));
    router.replace("/onboarding");
  };

  if (loading) return <ProfileSkeleton />;

  return (
    <main className="w-full max-w-md mx-auto px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white/70 dark:bg-white/10 border border-black/10 dark:border-white/15 backdrop-blur flex items-center justify-center shadow">
          <span className="text-2xl">🔐</span>
        </div>
  <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Connexion</h1>
        <p className="text-slate-600 dark:text-slate-300">Accède à tes groupes et ton solde</p>
      </div>
  <GlassCard className="shadow-[0_12px_40px_rgba(0,0,0,0.14)]">

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-slate-700 dark:text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/50"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700 dark:text-slate-300">Mot de passe</span>
            <div className="mt-1 flex rounded-xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 overflow-hidden">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex-1 px-3 py-2 bg-transparent outline-none"
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="px-3 text-sm text-slate-600 dark:text-slate-300 hover:opacity-80">
                {showPwd ? "Masquer" : "Afficher"}
              </button>
            </div>
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <PillButton type="submit" block>Continuer</PillButton>
        </form>

  <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-300/60 dark:bg-white/15" />
          <span>ou</span>
          <div className="h-px flex-1 bg-slate-300/60 dark:bg-white/15" />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <PillButton onClick={() => signWith("google")} className="w-full border border-black/10 hover:bg-white/90 dark:bg-white dark:text-slate-900" variant="outline">
            Continuer avec Google (démo)
          </PillButton>
          <PillButton onClick={() => signWith("apple")} className="w-full bg-black text-white hover:opacity-90">
            Continuer avec Apple (démo)
          </PillButton>
        </div>

  <div className="mt-6 text-sm text-slate-700 dark:text-slate-300 text-center">
          Pas de compte ?
          <Link href="/register" className="ml-1 font-semibold underline">Créer un compte</Link>
        </div>
  </GlassCard>
    </main>
  );
}
