// Mock data layer for Phase 1 (UI-first). Swapped for Prisma/Postgres in a later phase.
// Contact details are masked sample values.

export type TaskLine = {
  category: string;
  letter: string;
  description: string;
  price: number; // incl. VAT (kr)
  durationMin: number;
  interval?: string;
  nextWeek?: string;
  fromSubscription?: boolean;
  isStandardTask?: boolean;
};

export type Contact = {
  id: number;
  name: string;
  isCompany: boolean;
  cvr?: string;
  street: string;
  city: string;
  att?: string;
  phone: string;
  email: string;
  revenueYtd: number | null;
  avgYearlyFromSubs: number;
  subscriptionCount: number;
};

export type Subscription = {
  id: number; // display "Abo. nr."
  pk: number; // internal URL pk
  contactId: number;
  deliveryAddress: string;
  tasks: TaskLine[];
  interval: string;
  fixedEmployee: string;
  nextWeek: string;
};

export type OrderStatus = "Afventer levering" | "Afsluttet" | "Mislykket planlægning";

export type Order = {
  id: number;
  contactId: number;
  deliveryAddress: string;
  deliveryDate: string; // ISO
  overdue: boolean;
  tasks: TaskLine[];
  employee: string;
  status: string;
  source: string;
};

export const CONTACTS: Contact[] = [
  { id: 201482, name: "McDonald's Stilling", isCompany: true, cvr: "38242520", street: "Ørnedvej 4", city: "8660 Skanderborg", att: "—", phone: "+45 •• •• •• ••", email: "••••@••••.dk", revenueYtd: 12140, avgYearlyFromSubs: 34852, subscriptionCount: 1 },
  { id: 201455, name: "Nordic Sport Invest 2", isCompany: true, street: "Hospitalsgade 6", city: "8700 Horsens", att: "—", phone: "+45 •• •• •• ••", email: "••••@••••.dk", revenueYtd: null, avgYearlyFromSubs: 21080, subscriptionCount: 1 },
  { id: 201391, name: "Bilhuset A/S", isCompany: true, street: "Vejlevej 120", city: "8700 Horsens", phone: "+45 •• •• •• ••", email: "••••@••••.dk", revenueYtd: 4300, avgYearlyFromSubs: 0, subscriptionCount: 0 },
];

export const SUBSCRIPTIONS: Subscription[] = [
  {
    id: 235844, pk: 378378, contactId: 201482, deliveryAddress: "Ørnedvej 4, 8660 Skanderborg",
    interval: "Hver 2. uge", fixedEmployee: "Ingen", nextWeek: "Uge 29",
    tasks: [
      { category: "Vinduespudsning", letter: "U", description: "Pudsning udvendig", price: 470, durationMin: 15, interval: "Hver gang (hver 2. uge)", nextWeek: "Uge 29", isStandardTask: true },
      { category: "Vinduespudsning", letter: "I", description: "Pudsning indvendig", price: 470, durationMin: 15, interval: "Hver 2. gang (hver 4. uge)", nextWeek: "Uge 31", isStandardTask: true },
    ],
  },
  {
    id: 235837, pk: 378201, contactId: 201455, deliveryAddress: "Hospitalsgade 6, 8700 Horsens",
    interval: "Hver uge", fixedEmployee: "Ingen", nextWeek: "Uge 28",
    tasks: [{ category: "Viceværtservice", letter: "V", description: "Fjern spindelvæv", price: 811, durationMin: 45, interval: "Hver gang (hver uge)", nextWeek: "Uge 28", isStandardTask: true }],
  },
];

export const ORDERS: Order[] = [
  {
    id: 2080056, contactId: 201482, deliveryAddress: "Ørnedvej 4, 8660 Skanderborg", deliveryDate: "2026-07-13", overdue: true,
    employee: "Kristian Klercke", status: "Afventer levering, ikke afsluttet eller indmeldt", source: "Abo. #235844",
    tasks: [
      { category: "Vinduespudsning", letter: "U", description: "Pudsning udvendig", price: 470, durationMin: 15, fromSubscription: true },
      { category: "Vinduespudsning", letter: "I", description: "Pudsning indvendig", price: 470, durationMin: 15, fromSubscription: true },
      { category: "Andet", letter: "A", description: "Fjernelse af spindelvæv alle steder", price: 578, durationMin: 30, fromSubscription: true },
    ],
  },
  {
    id: 2079914, contactId: 201455, deliveryAddress: "Hospitalsgade 6, 8700 Horsens", deliveryDate: "2027-01-04", overdue: false,
    employee: "Kristian Klercke", status: "Afventer levering, ikke afsluttet eller indmeldt", source: "Abo. #235837",
    tasks: [{ category: "Viceværtservice", letter: "V", description: "Fjern spindelvæv", price: 811, durationMin: 45, fromSubscription: true }],
  },
];

export const kr = (n: number | null) => (n == null ? "-" : "kr. " + n.toLocaleString("da-DK"));
export const contactById = (id: number) => CONTACTS.find((c) => c.id === id);
