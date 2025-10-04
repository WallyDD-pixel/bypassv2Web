"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import usePageLoading from "@/hooks/usePageLoading";
import { useBadges } from "@/hooks/useBadges";

const items = [
  { href: "/", label: "Accueil" },
  { href: "/explore", label: "Explorer" },
  { href: "/requests", label: "Mes demandes" },
  { href: "/profile", label: "Profil" },
];

export default function TopNav() {
  const pathname = usePathname();
  const loading = usePageLoading();
  const [clicked, setClicked] = useState<string | null>(null);
  const { badges } = useBadges();
  useEffect(() => {
    if (!loading) setClicked(null);
  }, [loading]);
  return (
    <header className="hidden md:block">
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(980px,calc(100%-2rem))]">
        <div className="backdrop-blur-xl bg-white/65 dark:bg-white/5 border border-white/40 dark:border-white/15 shadow-[0_10px_30px_rgba(31,38,135,0.18)] rounded-2xl">
          <div className="px-4 h-14 flex items-center gap-4">
            <div className="px-3 py-2 rounded-xl font-semibold text-slate-900 dark:text-white bg-white/70 dark:bg-white/10 border border-white/60 dark:border-white/15 shadow-sm">
              Bypass
            </div>
            <nav className="flex-1 flex items-center gap-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setClicked(item.href)}
                    className={`px-3 py-2 rounded-xl text-sm transition-colors text-slate-900/90 dark:text-white/90 flex items-center gap-2 ${
                      active
                        ? "bg-white/80 dark:bg-white/15 border border-white/60 dark:border-white/10 shadow-sm"
                        : "hover:bg-white/60 dark:hover:bg-white/10 border border-transparent"
                    }`}
                  >
                    {item.label}
                    {item.href === "/requests" && badges.requests > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[11px] leading-[18px] font-bold">
                        {badges.requests > 99 ? '99+' : badges.requests}
                      </span>
                    )}
                    {loading && clicked === item.href && (
                      <svg className="animate-spin h-4 w-4 text-emerald-600 ml-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="hidden lg:flex items-center gap-2">
              <Link
                href="/create"
                className="px-3 py-2 rounded-xl text-sm font-medium text-white bg-slate-900/80 hover:bg-slate-900 transition-colors shadow"
              >
                Créer un événement
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
