"use client";

import { useRouter } from "next/navigation";
import React from "react";

export default function MobileHeader({ title }: { title?: string }) {
  const router = useRouter();
  const [dynTitle, setDynTitle] = React.useState<string>("");

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setDynTitle(detail || "");
    };
    if (typeof window !== "undefined") {
      window.addEventListener("mobile-header:title", handler as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("mobile-header:title", handler as EventListener);
      }
    };
  }, []);
  return (
    <div className="md:hidden">
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(560px,calc(100%-2rem))]">
        <div className="backdrop-blur-xl bg-white/5 border border-white/15 shadow-lg rounded-2xl">
          <div className="px-2 py-2 h-12 flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Retour"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white hover:bg-black/5"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-6 h-6">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {dynTitle || title ? (
              <div className="flex-1 truncate font-medium text-white">{dynTitle || title}</div>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </div>
      </div>
      {/* Spacer to prevent content underlap */}
      <div className="h-16" />
    </div>
  );
}
