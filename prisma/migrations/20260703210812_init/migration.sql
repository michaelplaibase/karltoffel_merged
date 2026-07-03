-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "cvr" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "planTier" TEXT NOT NULL DEFAULT 'Pro',
    "hourlyPrice" INTEGER NOT NULL DEFAULT 600,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "calendarColor" TEXT,
    "activeCalendar" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveOnline" BOOLEAN NOT NULL DEFAULT false,
    "homeAddress" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "canSeePrices" BOOLEAN NOT NULL DEFAULT true,
    "canEditOrders" BOOLEAN NOT NULL DEFAULT true,
    "canHandlePayment" BOOLEAN NOT NULL DEFAULT true,
    "canChangePaymentOption" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "isCompany" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "cvr" TEXT,
    "ean" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "att" TEXT,
    "note" TEXT,
    "revenueYtd" INTEGER,
    "avgYearlyFromSubs" INTEGER NOT NULL DEFAULT 0,
    "skipDeliveryAddressOnInvoice" BOOLEAN NOT NULL DEFAULT false,
    "showDeliveryNameOnInvoice" BOOLEAN NOT NULL DEFAULT false,
    "skipInvoiceOverSms" BOOLEAN NOT NULL DEFAULT false,
    "invoiceChoicePreselect" TEXT NOT NULL DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StandardTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "letter" TEXT,
    "customerPresenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "StandardTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "customerPresenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "isStandardTask" BOOLEAN NOT NULL DEFAULT false,
    "fromSubscription" BOOLEAN NOT NULL DEFAULT false,
    "intervalMultiplier" TEXT,
    "startWeek" TEXT,
    "subscriptionId" INTEGER,
    "fixedPriceId" INTEGER,
    "orderId" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TaskLine_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskLine_fixedPriceId_fkey" FOREIGN KEY ("fixedPriceId") REFERENCES "FixedPriceAgreement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "displayNo" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "baseInterval" TEXT NOT NULL,
    "startWeek" TEXT,
    "nextWeek" TEXT,
    "fixedWeekdays" TEXT,
    "fixedTimeOfDay" TEXT,
    "fixedEmployee" TEXT NOT NULL DEFAULT 'Ingen',
    "notiOverride" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FixedPriceAgreement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "displayNo" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    CONSTRAINT "FixedPriceAgreement_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contactId" INTEGER NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "plannedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Afventer levering',
    "sourceType" TEXT NOT NULL,
    "subscriptionId" INTEGER,
    "fixedPriceId" INTEGER,
    "employeeId" INTEGER,
    "lockedFully" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "addressNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_fixedPriceId_fkey" FOREIGN KEY ("fixedPriceId") REFERENCES "FixedPriceAgreement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "HolidayWeek" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startWeek" DATETIME NOT NULL,
    "endWeek" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_displayNo_key" ON "Subscription"("displayNo");

-- CreateIndex
CREATE UNIQUE INDEX "FixedPriceAgreement_displayNo_key" ON "FixedPriceAgreement"("displayNo");
