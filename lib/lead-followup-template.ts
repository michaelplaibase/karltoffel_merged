// Skabelon for "Opfølgning på emne" — holdt i en separat fil (ikke i
// templates-config.ts), fordi Lead-variablerne ({{kunde_fornavn}} osv.) ikke
// passer ind i QuoteContact-shapen som TEMPLATES' øvrige skabeloner bygger på.
// Samme Template-shape, så den viser sig i skabelon-editoren (/templates) som
// enhver anden redigerbar skabelon — men indlæses eksplicit af lead-opfølgnings-
// composeren og app/actions/leads.ts.
import type { Template } from "./templates-config";

export const LEAD_FOLLOWUP_TEMPLATE: Template = {
  key: "lead-opfoelgning",
  menuLabel: "Opfølgning på emne",
  heading: "Opfølgning på emne",
  intro:
    "Skabelon til en venlig opfølgning på et emne (lead) fra hjemmesiden, som I endnu ikke har fået svar fra. Sendes fra Emnerlisten med ét klik — du kan altid rette teksten inden afsendelse.",
  editable: true,
  subjects: [
    {
      label: "E-mail emne",
      name: "lead_opfoelgning_email_subject",
      val: "Skal vi stadig passe din have?",
    },
  ],
  body: `Hej {{kunde_fornavn}}

Vi hørte fra dig via karltoffel.dk og ville blot høre, om du stadig er interesseret i at få hjælp til hus og have på {{leverings_adresse}}.

Vi lægger gerne en plan — enten en fast aftale, hvor du slipper for at tænke på det, eller et enkelt besøg. Sig blot til.

Svar på denne e-mail eller ring til os på {{dit_telefonnummer}}, så finder vi en løsning, der passer dig.

De bedste hilsner
{{dit_firmanavn}}
{{dit_telefonnummer}} · {{din_email}}`,
  smsSender: "Service SMS",
  variables: [
    { token: "{{kunde_fornavn}}", desc: "Fornavnet på emnet (første ord i navnet)." },
    { token: "{{leverings_adresse}}", desc: "Adressen emnet opgav på hjemmesiden." },
    { token: "{{dit_firmanavn}}", desc: "Navnet på din virksomhed." },
    { token: "{{dit_telefonnummer}}", desc: "Telefonnummeret på din virksomhed." },
    { token: "{{din_email}}", desc: "E-mailadressen på din virksomhed." },
  ],
  maxSubject: 100,
};
