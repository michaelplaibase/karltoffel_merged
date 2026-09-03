import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TOP_NAV } from "@/lib/nav";
import { SETTINGS_PAGES, buildSettingsPage } from "@/lib/settings-config";
import { getSettingsValues } from "@/lib/settings-store";
import { getMinuteRate } from "@/lib/queries";
import { getSessionUser } from "@/lib/api-auth";
import { getUsers } from "@/lib/users";
import { saveSettings } from "@/app/actions/settings";
import SettingsForm from "@/components/SettingsForm";
import MinuteRateForm from "@/components/MinuteRateForm";
import RecalculateDurationsButton from "@/components/RecalculateDurationsButton";

function labelFor(path: string): { label: string; en: string } | null {
  for (const menu of TOP_NAV) {
    for (const it of menu.items) if (it.href === path) return { label: it.label, en: it.en };
  }
  return null;
}

export default async function CatchAll({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const path = "/" + (slug ?? []).join("/");

  // Settings pages are data-driven from lib/settings-config, and persist into
  // the settings store (Company.settings JSON). /settings får derudover kortet
  // med minutprisen (Company.minutePriceOere) til varighedsberegning.
  if (SETTINGS_PAGES[path]) {
    // Virksomhedsbrede indstillinger er kun for administratorer — samme
    // afgrænsning som /users (og save-actions kræver også admin server-side).
    const me = await getSessionUser();
    if (!me) redirect("/login");
    if (!me.isAdmin) {
      return (
        <div className="container-1140" style={{ maxWidth: 900 }}>
          <div className="card">
            <div className="card-body">
              <h1 className="page-title">{SETTINGS_PAGES[path].title}</h1>
              <div className="table-empty">Kun administratorer har adgang til virksomhedens indstillinger.</div>
            </div>
          </div>
        </div>
      );
    }

    // /working-hours og /planning-settings genererer medarbejdersektionerne fra
    // databasens RIGTIGE aktive brugere (aldrig en hardcodet medarbejderliste).
    const needsEmployees = path === "/working-hours" || path === "/planning-settings";
    const employeeNames = needsEmployees ? (await getUsers(false)).map((u) => u.navn) : [];
    const page = buildSettingsPage(path, employeeNames)!;

    const values = await getSettingsValues(path);
    const form = <SettingsForm page={page} values={values} action={saveSettings.bind(null, path)} />;
    if (path === "/settings") {
      const minuteRate = await getMinuteRate();
      return (
        <>
          {form}
          <MinuteRateForm rate={minuteRate} />
          <RecalculateDurationsButton />
        </>
      );
    }
    return form;
  }

  // Kun KENDTE portalruter (fra topmenuen), der endnu ikke er bygget, viser
  // "Under udvikling". Alt andet — tastefejl, gamle bogmærker — er en rigtig
  // 404 (app/not-found.tsx), så brugeren kan se, at URL'en er forkert.
  const meta = labelFor(path);
  if (!meta) notFound();
  return (
    <div className="container-1140">
      <h1 className="page-title">{meta.label}</h1>
      <p className="page-desc">{`${meta.en} · ${path}`}</p>
      <div className="card">
        <div className="card-body">
          <div className="help-note">
            Denne side er endnu ikke bygget — den kommer i en senere fase. Brug i mellemtiden genvejene herunder.
          </div>
          <div className="row-actions" style={{ marginTop: 18 }}>
            <Link href="/calendar" className="btn btn-primary">Kalender</Link>
            <Link href="/customers" className="btn btn-outline-secondary">Kunder</Link>
            <Link href="/settings" className="btn btn-outline-secondary">Indstillinger</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
