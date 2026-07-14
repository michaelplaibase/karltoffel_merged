import Link from "next/link";
import { TOP_NAV } from "@/lib/nav";
import { SETTINGS_PAGES } from "@/lib/settings-config";
import { getSettingsValues } from "@/lib/settings-store";
import { getMinuteRate } from "@/lib/queries";
import { saveSettings } from "@/app/actions/settings";
import SettingsForm from "@/components/SettingsForm";
import MinuteRateForm from "@/components/MinuteRateForm";

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
    const values = await getSettingsValues(path);
    const form = <SettingsForm page={SETTINGS_PAGES[path]} values={values} action={saveSettings.bind(null, path)} />;
    if (path === "/settings") {
      const minuteRate = await getMinuteRate();
      return (
        <>
          {form}
          <MinuteRateForm rate={minuteRate} />
        </>
      );
    }
    return form;
  }

  const meta = labelFor(path);
  return (
    <div className="container-1140">
      <h1 className="page-title">{meta?.label ?? "Under udvikling"}</h1>
      <p className="page-desc">{meta ? `${meta.en} · ${path}` : path}</p>
      <div className="card">
        <div className="card-body">
          <div className="help-note">
            Denne side bygges i en senere fase. Se det fulde, navigerbare blueprint over alle undersider i{" "}
            <code>docs/fenster-blueprint/blueprint.html</code>.
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
