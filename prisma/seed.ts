// Seed the local SQLite DB with the sample data the UI was built against, so the
// pages render identically once they read from the DB instead of lib/data.ts.
//
// Explicit ids reproduce the live portal's quirks: the subscription "Abo. nr."
// (displayNo) differs from its URL pk (id), and orders/contacts keep their
// observed numbers. The five week-27 orders are the auto-planner's demo week.
import { PrismaClient } from "@prisma/client";
import { CATEGORIES } from "../lib/categories";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

const color = (cat: string) => CATEGORIES[cat] ?? "#888888";
const PHONE = "+45 •• •• •• ••";
const EMAIL = "••••@••••.dk";

// A task line as authored here; color is filled in from the category.
type Line = {
  category: string; letter: string; description: string; price: number; durationMin: number;
  interval?: string; startWeek?: string; isStandardTask?: boolean; fromSubscription?: boolean;
};
const line = (l: Line, i: number) => ({
  category: l.category, letter: l.letter, color: color(l.category),
  description: l.description, price: l.price, durationMin: l.durationMin,
  intervalMultiplier: l.interval ?? null, startWeek: l.startWeek ?? null,
  isStandardTask: l.isStandardTask ?? false, fromSubscription: l.fromSubscription ?? false,
  sort: i,
});

async function main() {
  // Idempotent: wipe in FK-safe order so re-running the seed is clean.
  await prisma.taskLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.fixedPriceAgreement.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.standardTask.deleteMany();
  await prisma.holidayWeek.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: { id: 1, name: "Karltoffel ApS", cvr: "38242520", planTier: "Pro", hourlyPrice: 600, minutePriceOere: 860 },
  });

  await prisma.user.create({
    data: {
      id: 1535, companyId: company.id, username: "kristianklercke",
      passwordHash: hashPassword("karltoffel"),
      firstName: "Kristian", lastName: "Klercke", email: EMAIL,
      calendarColor: "#a4d5ee", activeCalendar: true, isAdmin: true,
      homeAddress: "8660 Skanderborg",
    },
  });

  // Colleagues — extra calendar lanes so the swimlane board shows several employees.
  const colleagues = [
    { id: 1536, username: "bjarnehansen", firstName: "Bjarne", lastName: "Schmidt Hansen", calendarColor: "#2e7d5b", homeAddress: "8000 Aarhus C" },
    { id: 1537, username: "teddypedersen", firstName: "Teddy", lastName: "Pedersen", calendarColor: "#8b5cc4", homeAddress: "8600 Silkeborg" },
    { id: 1538, username: "danielaneculaita", firstName: "Daniela", lastName: "Neculaita", calendarColor: "#c2506e", homeAddress: "8300 Odder" },
  ];
  for (const u of colleagues) {
    await prisma.user.create({
      data: {
        ...u, companyId: company.id, passwordHash: null, email: null,
        activeCalendar: true, isAdmin: false,
      },
    });
  }

  // ---- Contacts (a contact becomes a "customer" once it has an order/subscription) ----
  const contacts = [
    { id: 201482, name: "McDonald's Stilling", isCompany: true, cvr: "38242520", street: "Ørnedvej 4", city: "8660 Skanderborg", att: "—", revenueYtd: 12140, avgYearlyFromSubs: 34852 },
    { id: 201455, name: "Nordic Sport Invest 2", isCompany: true, street: "Hospitalsgade 6", city: "8700 Horsens", att: "—", revenueYtd: null, avgYearlyFromSubs: 21080 },
    { id: 201391, name: "Bilhuset A/S", isCompany: true, street: "Vejlevej 120", city: "8700 Horsens", revenueYtd: 4300, avgYearlyFromSubs: 0 },
    { id: 201310, name: "Aarhus Storkøkken", isCompany: true, street: "Mejlgade 12", city: "8000 Aarhus C", revenueYtd: null, avgYearlyFromSubs: 41600 },
    { id: 201288, name: "Odder Boghandel", isCompany: true, street: "Rosensgade 20", city: "8300 Odder", revenueYtd: null, avgYearlyFromSubs: 0 },
  ];
  for (const c of contacts) {
    await prisma.contact.create({
      data: {
        id: c.id, companyId: company.id, isCompany: c.isCompany, companyName: c.isCompany ? c.name : null,
        cvr: c.cvr ?? null, name: c.name, phone: PHONE, email: EMAIL,
        street: c.street, city: c.city, att: c.att ?? null,
        revenueYtd: c.revenueYtd, avgYearlyFromSubs: c.avgYearlyFromSubs,
      },
    });
  }

  // ---- Subscriptions (id = internal pk, displayNo = "Abo. nr.") ----
  await prisma.subscription.create({
    data: {
      id: 378378, displayNo: 235844, contactId: 201482, deliveryAddress: "Ørnedvej 4, 8660 Skanderborg",
      baseInterval: "Hver 2. uge", startWeek: "Uge 29", nextWeek: "Uge 29", fixedEmployee: "Ingen",
      tasks: { create: [
        line({ category: "Vinduespudsning", letter: "U", description: "Pudsning udvendig", price: 470, durationMin: 15, interval: "Hver gang (hver 2. uge)", startWeek: "Uge 29", isStandardTask: true }, 0),
        line({ category: "Vinduespudsning", letter: "I", description: "Pudsning indvendig", price: 470, durationMin: 15, interval: "Hver 2. gang (hver 4. uge)", startWeek: "Uge 31", isStandardTask: true }, 1),
      ] },
    },
  });
  await prisma.subscription.create({
    data: {
      id: 378201, displayNo: 235837, contactId: 201455, deliveryAddress: "Hospitalsgade 6, 8700 Horsens",
      baseInterval: "Hver uge", startWeek: "Uge 28", nextWeek: "Uge 28", fixedEmployee: "Ingen",
      tasks: { create: [
        line({ category: "Viceværtservice", letter: "V", description: "Fjern spindelvæv", price: 811, durationMin: 45, interval: "Hver gang (hver uge)", startWeek: "Uge 28", isStandardTask: true }, 0),
      ] },
    },
  });
  await prisma.subscription.create({
    data: {
      id: 378150, displayNo: 235801, contactId: 201310, deliveryAddress: "Mejlgade 12, 8000 Aarhus C",
      baseInterval: "Hver 4. uge", startWeek: "Uge 30", nextWeek: "Uge 30", fixedEmployee: "Ingen",
      tasks: { create: [
        line({ category: "Vinduespudsning", letter: "U", description: "Pudsning udvendig", price: 1200, durationMin: 90, interval: "Hver gang (hver 4. uge)", startWeek: "Uge 30", isStandardTask: true }, 0),
      ] },
    },
  });

  // ---- Orders ----
  // Two future orders shown on the customer/orders lists.
  await prisma.order.create({
    data: {
      id: 2080056, contactId: 201482, deliveryAddress: "Ørnedvej 4, 8660 Skanderborg",
      plannedAt: new Date("2026-07-13T10:00:00Z"), sourceType: "subscription", subscriptionId: 378378, employeeId: 1536,
      tasks: { create: [
        line({ category: "Vinduespudsning", letter: "U", description: "Pudsning udvendig", price: 470, durationMin: 15, fromSubscription: true }, 0),
        line({ category: "Vinduespudsning", letter: "I", description: "Pudsning indvendig", price: 470, durationMin: 15, fromSubscription: true }, 1),
        line({ category: "Andet", letter: "A", description: "Fjernelse af spindelvæv alle steder", price: 578, durationMin: 30, fromSubscription: true }, 2),
      ] },
    },
  });
  await prisma.order.create({
    data: {
      id: 2079914, contactId: 201455, deliveryAddress: "Hospitalsgade 6, 8700 Horsens",
      plannedAt: new Date("2027-01-04T10:00:00Z"), sourceType: "subscription", subscriptionId: 378201, employeeId: 1537,
      tasks: { create: [
        line({ category: "Viceværtservice", letter: "V", description: "Fjern spindelvæv", price: 811, durationMin: 45, fromSubscription: true }, 0),
      ] },
    },
  });

  // Five orders due in week 27 (Mon 2026-06-29) — the auto-planner's demo week.
  const week27 = new Date("2026-06-29T10:00:00Z");
  const weekOrders = [
    { id: 1969863, contactId: 201482, address: "Ørnedvej 4, 8660 Skanderborg", source: "subscription", subId: 378378, locked: true, task: { category: "Vinduespudsning", letter: "U", description: "Pudsning udvendig og indvendig", price: 940, durationMin: 60 } },
    { id: 1969944, contactId: 201455, address: "Hospitalsgade 6, 8700 Horsens", source: "subscription", subId: 378201, locked: false, task: { category: "Viceværtservice", letter: "V", description: "Fjern spindelvæv", price: 811, durationMin: 45 } },
    { id: 1969951, contactId: 201391, address: "Vejlevej 120, 8700 Horsens", source: "manual", subId: null, locked: false, task: { category: "Rentvandsvask", letter: "R", description: "Rentvandsvask facade", price: 620, durationMin: 30 } },
    { id: 1969960, contactId: 201310, address: "Mejlgade 12, 8000 Aarhus C", source: "subscription", subId: 378150, locked: false, task: { category: "Vinduespudsning", letter: "U", description: "Pudsning udvendig", price: 1200, durationMin: 90 } },
    { id: 1969973, contactId: 201288, address: "Rosensgade 20, 8300 Odder", source: "online", subId: null, locked: false, task: { category: "Overfladerens", letter: "O", description: "Afrensning af overflader", price: 560, durationMin: 40 } },
  ];
  // Round-robin the week's orders across the four lanes so each is populated.
  const LANE_IDS = [1535, 1536, 1537, 1538];
  for (const [i, o] of weekOrders.entries()) {
    await prisma.order.create({
      data: {
        id: o.id, contactId: o.contactId, deliveryAddress: o.address, plannedAt: week27,
        sourceType: o.source, subscriptionId: o.subId, employeeId: LANE_IDS[i % LANE_IDS.length], lockedFully: o.locked,
        tasks: { create: [line({ ...o.task, fromSubscription: o.source === "subscription" }, 0)] },
      },
    });
  }

  // ---- Holiday week (Ferie): closes week 32 (Mon 2026-08-03). The order below
  // falls inside it and is therefore suppressed by the planner. ----
  const holidayMonday = new Date("2026-08-03T00:00:00Z");
  await prisma.holidayWeek.create({ data: { startWeek: holidayMonday, endWeek: holidayMonday } });
  await prisma.order.create({
    data: {
      id: 2080099, contactId: 201391, deliveryAddress: "Vejlevej 120, 8700 Horsens",
      plannedAt: new Date("2026-08-03T10:00:00Z"), sourceType: "manual", employeeId: 1538,
      tasks: { create: [line({ category: "Rentvandsvask", letter: "R", description: "Rentvandsvask facade", price: 620, durationMin: 30 }, 0)] },
    },
  });

  // ---- Standard tasks (catalogue) — the locked window-cleaning combos + a few per category ----
  const systemTasks = [
    "Pudsning udvendig", "Pudsning indvendig", "Pudsning forsatsvinduer",
    "Pudsning udvendig og indvendig", "Pudsning indvendig og forsats",
    "Pudsning udvendig, indvendig og forsats",
  ];
  await prisma.standardTask.createMany({
    data: systemTasks.map((description) => ({
      companyId: company.id, category: "Vinduespudsning", description,
      letter: "V", isSystem: true, active: true,
    })),
  });
  const extraTasks: [string, string][] = [
    ["Rentvandsvask", "Rentvandsvask facade"],
    ["Viceværtservice", "Fjern spindelvæv"],
    ["Overfladerens", "Afrensning af overflader"],
    ["Tagrenderens", "Rensning af tagrender"],
    ["Algebehandling", "Algebehandling af tag"],
    ["Andet", "Fjernelse af spindelvæv alle steder"],
  ];
  await prisma.standardTask.createMany({
    data: extraTasks.map(([category, description]) => ({
      companyId: company.id, category, description,
      letter: category[0].toUpperCase(), isSystem: false, active: true,
    })),
  });

  // Postgres: inserting EXPLICIT ids above does NOT advance the SERIAL sequences,
  // so without this the next app-created row would collide on the primary key.
  // Reset each sequence to max(id)+1 (or 1 for empty tables). No-op on non-Postgres.
  if (process.env.DATABASE_URL?.startsWith("postgres")) {
    const tables = ["Company", "User", "Contact", "StandardTask", "TaskLine", "Subscription", "FixedPriceAgreement", "Order", "DiscountCode", "HolidayWeek"];
    for (const t of tables) {
      await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${t}"','id'), COALESCE((SELECT MAX(id) FROM "${t}"), 0) + 1, false)`);
    }
  }

  const counts = {
    companies: await prisma.company.count(),
    users: await prisma.user.count(),
    contacts: await prisma.contact.count(),
    subscriptions: await prisma.subscription.count(),
    orders: await prisma.order.count(),
    taskLines: await prisma.taskLine.count(),
    standardTasks: await prisma.standardTask.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
