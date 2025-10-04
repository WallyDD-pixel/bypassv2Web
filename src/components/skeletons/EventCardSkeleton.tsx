"use client";
import React from "react";

export default function EventCardSkeleton() {
  return (
    <div className="relative rounded-2xl overflow-hidden max-w-[360px] m-4 flex flex-col border border-white/15 bg-white/5 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.14)] animate-pulse">
      <div className="relative">
        <div className="w-full h-[200px] bg-slate-200/70 dark:bg-white/10" />
        <div className="absolute top-3 left-3 rounded-xl px-3 py-2 bg-black/30 border border-white/40 dark:border-white/20">
          <div className="h-5 w-10 bg-white/10 rounded" />
        </div>
      </div>
      <div className="p-5">
        <div className="h-6 w-56 bg-slate-200/70 dark:bg-white/10 rounded mb-2" />
        <div className="h-4 w-40 bg-slate-200/70 dark:bg-white/10 rounded mb-3" />
        <div className="h-4 w-48 bg-slate-200/70 dark:bg-white/10 rounded mb-2" />
        <div className="h-4 w-64 bg-slate-200/70 dark:bg-white/10 rounded" />
      </div>
    </div>
  );
}
