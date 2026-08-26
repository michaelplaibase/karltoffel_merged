import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { TEMPLATES } from "@/lib/templates-config";
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
  const t = TEMPLATES.find((x) => x.key === key);
  if (!t) notFound();
  const values = await getTemplateValues(key);
  return <TemplateEditor t={t} action={saveTemplate.bind(null, key)} values={values} />;
}
