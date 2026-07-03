// View types shared between the DB access layer (lib/queries.ts) and the pages.
// These describe the shape the UI renders; lib/queries maps Prisma rows onto them.
// (The former in-memory sample arrays now live in the database — see prisma/seed.ts.)

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

export const kr = (n: number | null) => (n == null ? "-" : "kr. " + n.toLocaleString("da-DK"));
