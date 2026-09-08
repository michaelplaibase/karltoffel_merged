// Skabelon for "Anmeldelses-anmodning" — sendes fra en afsluttet ordre med ét
// klik (se app/orders/[id]/anmeldelse). Separat fil af samme grund som
// lead-opfølgnings-skabelonen: ordre-variablerne passer ikke i QuoteContact-
// shapen, men skabelonen skal kunne redigeres i /templates som alle andre.
import type { Template } from "./templates-config";

export const REVIEW_REQUEST_TEMPLATE: Template = {
  key: "anmeldelse",
  menuLabel: "Anmeldelses-anmodning",
  heading: "Anmeldelses-anmodning",
  intro:
    "Sendes til kunden efter en afsluttet opgave med et kort tak og et direkte link til jeres Google-profil, hvor kunden kan give en anmeldelse. Sendes fra ordresiden med ét klik — teksten kan rettes inden afsendelse.",
  editable: true,
  subjects: [
    {
      label: "E-mail emne",
      name: "anmeldelse_email_subject",
      val: "Tak for i dag — 30 sekunder til en anmeldelse?",
    },
  ],
  body: `Hej {{kunde_fornavn}}

Tak for opgaven i dag på {{leverings_adresse}} — vi håber, resultatet er noget, du kan nyde.

Har du 30 sekunder, ville en kort anmeldelse betyde rigtig meget for os. Det tager kun et øjeblik:

{{anmeldelse_link}}

Tak fordi du er en heldig kartoffel hos os.

De bedste hilsner
{{dit_firmanavn}}
{{dit_telefonnummer}} · {{din_email}}`,
  smsSender: "Service SMS",
  variables: [
    { token: "{{kunde_fornavn}}", desc: "Fornavnet på kunden (første ord i navnefeltet)." },
    { token: "{{leverings_adresse}}", desc: "Ordrens leveringsadresse." },
    { token: "{{anmeldelse_link}}", desc: "Link til jeres Google-profil (sættes under Indstillinger)." },
    { token: "{{dit_firmanavn}}", desc: "Navnet på din virksomhed." },
    { token: "{{dit_telefonnummer}}", desc: "Telefonnummeret på din virksomhed." },
    { token: "{{din_email}}", desc: "E-mailadressen på din virksomhed." },
  ],
  maxSubject: 100,
};
