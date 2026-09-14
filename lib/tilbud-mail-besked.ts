/** Thomas, 2026-09-12 (fejlretning): standard-mailteksten er ren (ingen
 *  prisma/PDF-import) så den kan testes direkte. Nævner ÅRSLIGT beløb
 *  (linjer med interval) i stedet for det samlede beløb — og altid det
 *  offentlige godkend-link som absolut URL. */
export function tilbudMailBesked(data: {
  hilsenNavn: string;
  titel: string;
  aarligt?: number | null;
  godkendUrl?: string | null;
}): string {
  const prisSaetning =
    data.aarligt != null
      ? `opgaverne der løber over året (${data.aarligt.toLocaleString("da-DK")} kr. om året inkl. moms)`
      : `opgaverne`;
  const linkLinje = data.godkendUrl ? `\n\nGodkend tilbud her: ${data.godkendUrl}` : "";
  return (
    `Hej ${data.hilsenNavn}!\n\n` +
    `Vedhæftet finder du vores ${data.titel.toLowerCase()} med priserne på ${prisSaetning}.\n\n` +
    `Vil du sige ja, kan du klikke "Godkend tilbud" i mailen — så noterer vi det direkte i vores system. ` +
    `Du kan også bare ringe eller skrive til os.${linkLinje}\n\n` +
    `Vi hører gerne fra dig!\n\nMvh Karltoffel`
  );
}

/** Offentlig base-URL til kundefacing links (samme mønster som slack-lead.ts). */
export function crmBaseUrl(env: { CRM_BASE_URL?: string } = process.env as unknown as { CRM_BASE_URL?: string }): string {
  return (env.CRM_BASE_URL?.trim() || "https://crm.karltoffel.dk").replace(/\/$/, "");
}
