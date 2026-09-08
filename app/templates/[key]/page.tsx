import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { TEMPLATES } from "@/lib/templates-config";
import { LEAD_FOLLOWUP_TEMPLATE } from "@/lib/lead-followup-template";
import { REVIEW_REQUEST_TEMPLATE } from "@/lib/review-request-template";
import { getTemplateValues } from "@/lib/settings-store";
import { saveTemplate } from "@/app/actions/settings";
import TemplateEditor from "@/components/TemplateEditor";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  // Skabelonerne bruges i rigtige kundemails (fx tilbud) — kun administratorer
  // må redigere dem (samme afgrænsning som /users; saveTemplate kræver også admin).
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) {
    return (
      <div className="container-1140" style={{ maxWidth: 860 }}>
        <div className="card">
          <div className="card-body">
            <h1 className="page-title">E-mail og SMS skabeloner</h1>
            <div className="table-empty">Kun administratorer har adgang til skabelonerne.</div>
          </div>
        </div>
      </div>
    );
  }

  const { key } = await params;
  // "Opfølgning på emne" + "Anmeldelses-anmodning" bor i egne filer (Lead-/ordre-
  // variabler passer ikke ind i templates-configs QuoteContact-shape) men
  // redigeres som enhver anden skabelon her — samme getTemplateValues-nøgle
  // som actions læser.
  const t =
    key === "lead-opfoelgning" ? LEAD_FOLLOWUP_TEMPLATE
    : key === "anmeldelse" ? REVIEW_REQUEST_TEMPLATE
    : TEMPLATES.find((x) => x.key === key);
  if (!t) notFound();
  const values = await getTemplateValues(key);
  return <TemplateEditor t={t} action={saveTemplate.bind(null, key)} values={values} />;
}
