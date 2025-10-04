"use client";
import React, { useEffect, useRef, useState } from "react";

type DeferredPromptEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: "accepted" | "dismissed" }> };

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-ignore
  const iosStandalone = window.navigator?.standalone === true;
  // General (display-mode)
  const dm = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || dm;
}

export default function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const deferredRef = useRef<DeferredPromptEvent | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Ne rien afficher si déjà installé ou si l’utilisateur a refusé
    if (isInStandaloneMode()) return;
    if (localStorage.getItem("pwa:install:dismissed") === "1") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault?.();
      deferredRef.current = e as DeferredPromptEvent;
      setMode("android");
      setShow(true);
    };

    const onAppInstalled = () => {
      setShow(false);
      deferredRef.current = null;
      localStorage.setItem("pwa:installed", "1");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall as any);
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS: pas de beforeinstallprompt → montrer instructions si pas standalone
    if (isIos()) {
      setMode("ios");
      setShow(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as any);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!show || !mode) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] px-2 py-1" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto max-w-3xl rounded-lg border border-white/10 backdrop-blur-xl bg-white/50 dark:bg-white/5 shadow-lg text-slate-900 dark:text-white px-2.5 py-1.5 flex items-center gap-2">
        <div className="flex-1 text-xs sm:text-sm">
          {mode === "android" ? (
            <>
              <strong>Installer l’application</strong> pour un accès rapide et des notifications plus fiables.
            </>
          ) : (
            <>
              <strong>Ajouter à l’écran d’accueil</strong> pour un accès rapide et des notifications. Ouvrez le menu Partager puis “Ajouter à l’écran d’accueil”.
            </>
          )}
        </div>
        {mode === "android" && (
          <button
            className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
            onClick={async () => {
              const evt = deferredRef.current;
              try { await evt?.prompt(); } catch {}
              setShow(false);
              localStorage.setItem("pwa:install:prompted", "1");
            }}
          >
            Installer
          </button>
        )}
        {mode === "ios" && (
          <button
            className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
            onClick={() => setHelp(true)}
          >
            Guide
          </button>
        )}
        <button
          className="px-2 py-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:underline"
          onClick={() => {
            setShow(false);
            localStorage.setItem("pwa:install:dismissed", "1");
          }}
        >
          Ne plus afficher
        </button>
      </div>

      {help && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setHelp(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-white/90 dark:bg-slate-900/95 text-slate-900 dark:text-white p-4 shadow-xl">
            <div className="text-base sm:text-lg font-semibold mb-2">Ajouter à l’écran d’accueil (iOS)</div>
            <ol className="list-decimal ml-5 space-y-1 text-xs sm:text-sm">
              <li>Appuyez sur le bouton <strong>Partager</strong> dans la barre du navigateur.</li>
              <li>Choisissez <strong>Ajouter à l’écran d’accueil</strong>.</li>
              <li>Validez le nom et appuyez sur <strong>Ajouter</strong>.</li>
            </ol>
            <div className="mt-3 flex justify-end">
              <button className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs sm:text-sm" onClick={() => setHelp(false)}>J’ai compris</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
