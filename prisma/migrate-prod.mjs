// Run `prisma migrate deploy` for production AND preview builds. Previews share
// the production database, so a preview with un-applied migrations crashes at
// runtime (fx /fakturering, fejl-id 2368054365: OpenInvoice/InvoiceManualLine
// tabellerne manglede, fordi 20260915090000_invoice_consolidation kun lå på
// feature-branchen og derfor aldrig blev kørt). Migrations er committet på
// branchen, så en preview kan sikkert anvende dem — samme regler som prod.
import { execSync } from "node:child_process";

console.log(`[migrate-prod] Running prisma migrate deploy (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
execSync("prisma migrate deploy", { stdio: "inherit" });
