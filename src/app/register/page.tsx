"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProfileSkeleton from "@/components/skeletons/ProfileSkeleton";

export default function RegisterPage() {
  const { login, setUser, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace("/");
  }, [loading, isAuthenticated, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
  if (!name.trim()) return setError("Nom d’utilisateur requis");
    if (!email.trim()) return setError("Email requis");
    if (password.length < 6) return setError("Mot de passe trop court (min. 6)");
    if (password !== confirm) return setError("Les mots de passe ne correspondent pas");
  // Onboarding: stocker un utilisateur en attente dans localStorage puis rediriger vers /onboarding
  const pending = { name: name.trim(), email: email.trim() };
  localStorage.setItem("auth:pendingUser", JSON.stringify(pending));
  router.replace("/onboarding");
  };

  const signWith = (provider: "google" | "apple") => {
    const display = provider === "google" ? "Google User" : "Apple User";
    const mail = provider === "google" ? "google.user@example.com" : "apple.user@example.com";
  // Social demo: passer aussi par l'onboarding (photo obligatoire)
  localStorage.setItem("auth:pendingUser", JSON.stringify({ name: display, email: mail }));
  router.replace("/onboarding");
  };

  if (loading) return <ProfileSkeleton />;

  return (
    <main className="w-full max-w-md mx-auto px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center shadow">
          <span className="text-2xl">📝</span>
        </div>
  <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white">Créer un compte</h1>
  <p className="text-white/80">Rejoindre des groupes</p>
      </div>

      <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-slate-700 d’utilisateur</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/50"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/50"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700 de passe</span>
            <div className="mt-1 flex rounded-xl border border-white/15 bg-white/5 overflow-hidden">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex-1 px-3 py-2 bg-transparent outline-none"
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="px-3 text-sm text-slate-600 hover:opacity-80">
                {showPwd ? "Masquer" : "Afficher"}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="text-sm text-slate-700 le mot de passe</span>
            <input
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 outline-none"
            />
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button type="submit" className="w-full rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white shadow hover:opacity-90">Créer mon compte</button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-300/60 />
          <span>ou</span>
          <div className="h-px flex-1 bg-slate-300/60 />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button onClick={() => signWith("google")} className="w-full rounded-xl px-4 py-2 text-sm font-semibold bg-white text-slate-900 border border-white/15 hover:bg-white
            Continuer avec Google (démo)
          </button>
          <button onClick={() => signWith("apple")} className="w-full rounded-xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90">
            Continuer avec Apple (démo)
          </button>
        </div>

        <div className="mt-6 text-sm text-slate-700 text-center">
          Déjà un compte ?
          <Link href="/login" className="ml-1 font-semibold underline">Se connecter</Link>
        </div>
      </div>
    </main>
  );
}
