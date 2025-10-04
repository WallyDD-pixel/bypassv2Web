"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useBadges } from "@/hooks/useBadges";

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
    <path d="M3 10.5L12 3l9 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M9 21v-6a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
    <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2"/>
    <path d="M21 21l-3.8-3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconReview = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
    {/* checklist lines */}
    <path d="M9 8h9M9 12h9M9 16h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    {/* left markers: check, cross, dot */}
    <path d="M4.5 8l1.3 1.3L8 7.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.8 11.2l3 3M7.8 11.2l-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="6.3" cy="16" r="1.4" stroke="currentColor" strokeWidth="2"/>
  </svg>
);
const IconStar = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
    <path d="M12 3.4l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17.6 6.8 19.4l1-5.8L3.6 9.5l5.8-.8L12 3.4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);
const IconRequests = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
    {/* clipboard */}
    <rect x="6" y="5" width="12" height="15" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M9 5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V6H9v-.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    {/* list lines */}
    <path d="M9 10.5h6M9 14h6M9 17.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
    <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconQR = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
    {/* corner brackets */}
    <path d="M4 9V6a2 2 0 0 1 2-2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M20 9V6a2 2 0 0 0-2-2h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M4 15v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M20 15v3a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    {/* finder patterns */}
    <rect x="7" y="7" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="2"/>
    <rect x="13.5" y="7" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="2"/>
    <rect x="7" y="13.5" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="2"/>
    {/* small code bits */}
    <path d="M14 14h1.5M16.5 14H18M16.5 16.5H18M14 16.5h1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconChat = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
    <path d="M20 12a7 7 0 1 1-13.7 2.2L4 20l4-1.2A7 7 0 1 1 20 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="9" cy="12" r="1.2" fill="currentColor"/>
    <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
    <circle cx="15" cy="12" r="1.2" fill="currentColor"/>
  </svg>
);

// Nouveau pictogramme Message: enveloppe
const IconEnvelope = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const icons = {
  home: <IconHome />,
  search: <IconSearch />,
  review: <IconReview />,
  chat: <IconChat />,
  requests: <IconRequests />,
  user: <IconUser />,
};
type IconKey = keyof typeof icons;

const navItems: { href: string; label: string; icon: IconKey }[] = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/explore", label: "Explorer", icon: "search" },
  { href: "/requests", label: "Mes demandes", icon: "requests" },
  { href: "/profile", label: "Profil", icon: "user" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { badges } = useBadges();

  const isActive = (p: string, href: string) => p === href || p.startsWith(href + "/");

  const NavItem = ({ href, label, icon, badge }: { href: string; label: string; icon: IconKey; badge?: number }) => {
    const active = isActive(pathname, href);
    return (
      <motion.a
        key={href}
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        title={label}
  className="p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 rounded-full"
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.04 }}
      >
        <span
          aria-hidden
          className={`flex items-center justify-center w-10 h-10 transition-colors rounded-xl border ${
            active
              ? "text-white opacity-100 bg-white/10 border-white/60 dark:border-white/10 shadow-sm"
              : "text-slate-600 dark:text-slate-300 opacity-75 hover:opacity-100 bg-transparent border-transparent"
          }`}
        >
          <span className="relative inline-block">
            {icons[icon]}
            {typeof badge === "number" && badge > 0 && (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] leading-4 font-bold grid place-items-center ring-1 ring-white/80 dark:ring-black/50"
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </span>
        </span>
        <span className="sr-only">{label}</span>
      </motion.a>
    );
  };

  return (
    <nav className="fixed left-1/2 -translate-x-1/2 z-50 w-[min(560px,calc(100%-2rem))] md:hidden" style={{ bottom: "max(8px, env(safe-area-inset-bottom, 0px) + 4px)" }}>
      <div className="relative backdrop-blur-xl bg-white/5 border border-white/50 dark:border-white/15 shadow-[0_10px_30px_rgba(31,38,135,0.18)] rounded-2xl px-4 py-2 text-white">
        {/* Grille stable: 2 colonnes gauche, 1 vide pour la bulle Scan, 3 à droite */}
        <div className="grid grid-cols-6 items-center gap-x-6">
          <div className="col-span-2 flex items-center justify-evenly gap-6 pr-3">
            <NavItem href={navItems[0].href} label={navItems[0].label} icon={navItems[0].icon} />
            <NavItem href={navItems[1].href} label={navItems[1].label} icon={navItems[1].icon} />
          </div>
          <div className="col-span-1" aria-hidden />
          <div className="col-span-3 flex items-center justify-evenly gap-6 pl-3">
            <NavItem href={navItems[2].href} label={navItems[2].label} icon={navItems[2].icon} badge={badges.requests} />
            <NavItem href={navItems[3].href} label={navItems[3].label} icon={navItems[3].icon} />
          </div>
        </div>

        {/* Center QR bubble */}
        <Link
          href="/scan"
          aria-label="Scanner un QR code"
          className="absolute -top-5 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl ring-2 ring-white/90 dark:ring-black/50 flex items-center justify-center z-10"
          title="Scanner un QR code"
        >
          <span className="scale-110"><IconQR /></span>
          {badges.requests > 0 && (
            <span
              aria-hidden
              className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] leading-4 font-bold grid place-items-center ring-1 ring-white/80 dark:ring-black/50"
            >
              {badges.requests > 99 ? '99+' : badges.requests}
            </span>
          )}
        </Link>

        {/* Grosse bulle Messages (top-right) */}
        <Link
          href="/messages"
          aria-label="Messages"
          title="Messages"
          className="absolute -top-15 right-4 w-12 h-12 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl ring-2 ring-white/90 dark:ring-black/50 flex items-center justify-center z-10"
        >
          <span className="scale-110"><IconEnvelope /></span>
          {badges.messages > 0 && (
            <span
              aria-hidden
              className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] leading-4 font-bold grid place-items-center ring-1 ring-white/80 dark:ring-black/50"
            >
              {badges.messages > 99 ? '99+' : badges.messages}
            </span>
          )}
          <span className="sr-only">Ouvrir Messages</span>
        </Link>
      </div>
    </nav>
  );
}
