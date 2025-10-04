import { slugify } from "@/lib/slugify";

export type Group = {
  name: string;
  members: number; // total
  maleCount: number;
  femaleCount: number;
  avatarUrl?: string; // owner avatar
  memberAvatars?: string[]; // avatars of members
  // optional metadata from creation flow
  pricePerMale?: number; // € demandé par homme
  arrivalTime?: string; // "HH:MM" souhaitée
};

export type Event = {
  title: string;
  startAt: string; // ISO
  venue: string;
  city: string;
  description: string;
  imageUrl: string;
  price: string; // e.g. "15 €" ou "Gratuit" (fallback d’affichage)
  // Champs enrichis (scraping) pour calculer l’affichage: Gratuit ou "À partir de X".
  isFree?: boolean;
  minPrice?: number; // en devise indiquée, le prix le plus bas
  currency?: string; // ex: "EUR"
  ticketPrices?: number[]; // liste de tarifs si disponible
  ticketsUrl: string;
  groupsGoing: Group[];
};

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
const today = new Date();
const mkDate = (daysFromToday: number, hour = 20) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysFromToday, hour, 0, 0);
  return iso(d);
};

const avatar = (i: number) => `/api/placeholder/avatar-${(i % 10) + 1}.png`;
const genMemberAvatars = (n: number, seed = 0) => Array.from({ length: n }, (_, i) => avatar(i + seed));
const genGroups = (count: number, prefix = "Groupe") =>
  Array.from({ length: count }, (_, i) => {
    const male = ((i * 5) % 10) + 3; // 3..12
    const female = ((i * 7) % 8) + 2; // 2..9
    const members = male + female;
    return {
      name: `${prefix} ${i + 1}`,
      members,
      maleCount: male,
      femaleCount: female,
      avatarUrl: avatar(i),
      memberAvatars: genMemberAvatars(members, i),
    } as Group;
  });

export const events: Event[] = [
  {
    title: "Soirée Techno Paris",
    startAt: mkDate(0, 22),
    venue: "Rex Club",
    city: "Paris",
    description: "Vivez une nuit électro avec les meilleurs DJs internationaux.",
  imageUrl: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=1600&q=80", // paysage
  price: "20 €",
  minPrice: 20,
  currency: "EUR",
    ticketsUrl: "https://shotgun.live/",
    groupsGoing: genGroups(45, "Crew"),
  },
  {
    title: "Concert Indie Rock",
    startAt: mkDate(1, 20),
    venue: "Le Trianon",
    city: "Paris",
    description: "Les groupes montants de la scène indie réunis pour une soirée unique.",
  imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80", // paysage
  price: "15 €",
  minPrice: 15,
  currency: "EUR",
  ticketPrices: [15, 19, 25],
    ticketsUrl: "https://shotgun.live/",
  groupsGoing: [],
  },
  {
    title: "Festival Open Air",
    startAt: mkDate(3, 18),
    venue: "Parc de la Villette",
    city: "Paris",
    description: "Un festival en plein air avec foodtrucks, animations et concerts.",
  imageUrl: "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1600&q=80", // paysage
  price: "Gratuit",
  isFree: true,
    ticketsUrl: "https://shotgun.live/",
  groupsGoing: [],
  },
  {
    title: "Jazz Night Session",
    startAt: mkDate(0, 19),
    venue: "New Morning",
    city: "Paris",
    description: "Ambiance feutrée et improvisations live.",
  imageUrl: "https://images.unsplash.com/photo-1465101178521-c1a9136a3b99?auto=format&fit=crop&w=1600&q=80", // paysage
  price: "25 €",
  minPrice: 25,
  currency: "EUR",
    ticketsUrl: "https://shotgun.live/",
  groupsGoing: [],
  },
  {
    title: "Electro All Stars",
    startAt: mkDate(1, 23),
    venue: "Docks",
    city: "Paris",
    description: "Line-up explosif jusque tard dans la nuit.",
  imageUrl: "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1600&q=80", // paysage
  price: "30 €",
  minPrice: 30,
  currency: "EUR",
    ticketsUrl: "https://shotgun.live/",
  groupsGoing: [],
  },
  // Test event with no groups
  {
    title: "Soirée Test Sans Groupe",
    startAt: mkDate(2, 21),
    venue: "Le Pop-Up du Label",
    city: "Paris",
    description: "Événement de test pour l’état sans groupe.",
  imageUrl: "https://images.unsplash.com/photo-1465101178521-c1a9136a3b99?auto=format&fit=crop&w=1600&q=80", // paysage
  price: "12 €",
  minPrice: 12,
  currency: "EUR",
    ticketsUrl: "https://shotgun.live/",
    groupsGoing: [],
  },
];

export const eventSlug = (e: Event) => slugify(`${e.title}-${e.startAt.slice(0, 10)}`);

export const getEventBySlug = (slug: string) => {
  return events.find((e) => eventSlug(e) === slug) || null;
};
