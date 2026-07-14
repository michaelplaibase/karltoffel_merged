// Seed a fresh karltoffel_crm database with a CLEAN customer sheet: the company
// tenant, its employees, and the standard-task catalogue — and NO customers.
// Running it wipes every table (FK-safe order) and re-inserts only that baseline,
// so a freshly provisioned or reseeded CRM starts with zero contacts,
// subscriptions, orders, fixed-price agreements and leads. Real customers are
// added through the app.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

const EMAIL = "••••@••••.dk";

async function main() {
  // Idempotent: wipe in FK-safe order so re-running the seed is clean. Leads and
  // every customer-owned row are wiped here too, guaranteeing a clean sheet even
  // if the target DB already holds customer data.
  await prisma.taskLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.fixedPriceAgreement.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.standardTask.deleteMany();
  await prisma.holidayWeek.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: { id: 1, name: "Karltoffel ApS", cvr: "38242520", planTier: "Pro", hourlyPrice: 600 },
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
