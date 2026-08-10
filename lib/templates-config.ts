export type TemplateVar = { token: string; desc: string };
export type Template = {
  key: string;          // url slug (see list below)
  menuLabel: string;    // Danish submenu label
  heading: string;      // page <h1>/<h3> heading
  intro: string;        // intro paragraph (Danish, verbatim)
  editable: boolean;    // false for the stub/delegated pages
  subjects: { label: string; name: string; val: string }[]; // e-mail subject field(s)
  body?: string;        // default message body verbatim (with {{tokens}})
  smsSender?: string;   // usually "Service SMS"
  variables: TemplateVar[]; // merge variables valid on this page
  maxSubject?: number;  // 50 (or 100 for defrag)
  stubText?: string;    // for non-editable stub pages
  delegatesTo?: string; // e.g. "Dinero" for the invoice page
};
export const TEMPLATES: Template[] = [
  {
    key: "before-delivery",
    menuLabel: "Notifikation før levering",
    heading: "Notifikation før levering",
    intro:
      "Med nedenstående felter kan du tilpasse teksten i de notifikationer, der sendes til kunderne på e-mail og/eller SMS før levering. Hvorvidt der skal afsendes notifikation og hvor lang tid i forvejen, kan du indstille på denne side.",
    editable: true,
    subjects: [
      {
        label: "E-mail emne",
        name: "notification_template_email_subject",
        val: "Vi kommer og udfører service",
      },
    ],
    body: `Kære {{kunde_fornavn}}

Vi kommer {{leveringstidspunkt}} og udfører følgende opgaver iht. aftale.

{{opgave_liste}}

Såfremt en eller flere opgaver kræver adgang til din bolig, bedes du være hjemme til at åbne eller på anden måde sørge for, at vi får adgang til at kunne udføre opgaven.

De bedste hilsner
{{dit_firmanavn}}`,
    smsSender: "Service SMS",
    variables: [
      {
        token: "{{kunde_fornavn}}",
        desc: "Dette er fornavnet på kunden, hvilket svarer til det første ord i navnefeltet(Hvis kunden er et firma benyttes første ord i att. navnefeltet)",
      },
      {
        token: "{{kunde_fuldt_navn}}",
        desc: "Dette er det fulde navn på kunden, som indtastet i navnefeltet(Hvis kunden er et firma benyttes att. navnefeltet)",
      },
      {
        token: "{{leveringstidspunkt}}",
        desc: "Dette er leveringstidspunktet for ordren, dvs. det tidspunkt, hvor kunden skal have service. Bemærk at teksten vil variere baseret på dine notifikationsindstillinger.",
      },
      {
        token: "{{leverings_adresse}}",
        desc: "Dette er ordrens leveringsadresse",
      },
      {
        token: "{{opgave_liste}}",
        desc: "Dette er en liste over de opgaver, som skal udføres",
      },
      {
        token: "{{dit_firmanavn}}",
        desc: "Dette er navnet på din virksomhed",
      },
      {
        token: "{{dit_telefonnummer}}",
        desc: "Dette er telefonnummeret på din virksomhed",
      },
      {
        token: "{{din_email}}",
        desc: "Dette er e-mail adressen på din virksomhed",
      },
    ],
    maxSubject: 50,
  },
  {
    key: "after-delivery",
    menuLabel: "Notifikation efter levering",
    heading: "Notifikation efter levering",
    intro:
      "Med nedenstående felter kan du tilpasse teksten i de notifikationer, der sendes til kunderne på e-mail og/eller SMS efter levering har fundet sted, dvs. når en ordre meldes udført. Hvorvidt der skal afsendes notifikation kan du indstille på denne side.",
    editable: true,
    subjects: [
      {
        label: "E-mail emne",
        name: "after_delivery_email_subject",
        val: "Vi har udført service",
      },
    ],
    body: `Kære {{kunde_fornavn}}

Vi har netop udført service på adressen {{leverings_adresse}}. 

{{saetning_naeste_gang_uge_med_dato_interval}}

Tak fordi du er kunde hos os.

De bedste hilsner
{{dit_firmanavn}}`,
    smsSender: "Service SMS",
    variables: [
      {
        token: "{{kunde_fornavn}}",
        desc: "Dette er fornavnet på kunden, hvilket svarer til det første ord i navnefeltet(Hvis kunden er et firma benyttes første ord i att. navnefeltet)",
      },
      {
        token: "{{kunde_fuldt_navn}}",
        desc: "Dette er det fulde navn på kunden, som indtastet i navnefeltet(Hvis kunden er et firma benyttes att. navnefeltet)",
      },
      {
        token: "{{leverings_adresse}}",
        desc: "Dette er ordrens leveringsadresse",
      },
      {
        token: "{{opgave_liste}}",
        desc: "Dette er en liste over de opgaver, som er blevet udført på ordren",
      },
      {
        token: "{{dit_firmanavn}}",
        desc: "Dette er navnet på din virksomhed",
      },
      {
        token: "{{dit_telefonnummer}}",
        desc: "Dette er telefonnummeret på din virksomhed",
      },
      {
        token: "{{din_email}}",
        desc: "Dette er e-mail adressen på din virksomhed",
      },
      {
        token: "{{saetning_naeste_gang_uge_med_dato_interval}}",
        desc: "Dette er en sætning, der fortæller hvilken uge, kunden skal have service næste gang (med dato interval)",
      },
      {
        token: "{{saetning_naeste_gang_uge_uden_dato_interval}}",
        desc: "Dette er en sætning, der fortæller hvilken uge, kunden skal have service næste gang",
      },
    ],
    maxSubject: 50,
  },
  {
    key: "subscription-confirmation",
    menuLabel: "Abonnementsbekræftelse",
    heading: "Abonnementsbekræftelse",
    intro:
      "Sendes til kunder (valgfrit) ved oprettelse eller redigering af et abonnement. Du kan i den forbindelse vælge at vedhæfte dine Handelsbetingelser til bekræftelsen, hvis du ønsker det.",
    editable: true,
    subjects: [
      {
        label: "E-mail emne (ved oprettelse)",
        name: "subscription_confirmation_create_email_subject",
        val: "Tillykke med din nye aftale",
      },
      {
        label: "E-mail emne (ved opdatering)",
        name: "subscription_confirmation_edit_email_subject",
        val: "Vi har opdateret din aftale",
      },
    ],
    body: `Kære {{kunde_fornavn}}

Vi har aftalt at udføre følgende opgaver:

{{opgave_liste}}

{{pris_moms_info}}.

Næste gang er planlagt til {{naeste_gang_uge_med_dato_interval}}, hvor vi udfører {{naeste_gang_opgaver}}.

De bedste hilsner
{{dit_firmanavn}}`,
    smsSender: "Service SMS",
    variables: [
      {
        token: "{{kunde_fornavn}}",
        desc: "Dette er fornavnet på kunden, hvilket svarer til det første ord i navnefeltet(Hvis kunden er et firma benyttes første ord i att. navnefeltet)",
      },
      {
        token: "{{kunde_fuldt_navn}}",
        desc: "Dette er det fulde navn på kunden, som indtastet i navnefeltet(Hvis kunden er et firma benyttes att. navnefeltet)",
      },
      {
        token: "{{dit_firmanavn}}",
        desc: "Dette er navnet på din virksomhed",
      },
      {
        token: "{{dit_telefonnummer}}",
        desc: "Dette er telefonnummeret på din virksomhed",
      },
      {
        token: "{{din_email}}",
        desc: "Dette er e-mail adressen på din virksomhed",
      },
      {
        token: "{{leverings_adresse}}",
        desc: "Dette er abonnementets leveringsadresse",
      },
      {
        token: "{{opgave_liste}}",
        desc: "Dette er en nummereret liste af opgaver der er registreret på abonnementet",
      },
      {
        token: "{{pris_moms_info}}",
        desc: 'Dette er altid teksten "Alle priser er inkl. moms."',
      },
      {
        token: "{{naeste_gang_uge_med_dato_interval}}",
        desc: "Dette er ugenummeret, hvor kunden skal have service næste gang (med dato interval)",
      },
      {
        token: "{{naeste_gang_uge_uden_dato_interval}}",
        desc: "Dette er ugenummeret, hvor kunden skal have service næste gang (uden dato interval)",
      },
      {
        token: "{{naeste_gang_opgaver}}",
        desc: "Dette er numrene på opgaverne, der skal udføres ved næste besøg",
      },
    ],
    maxSubject: 50,
  },
  {
    key: "defrag",
    menuLabel: "Abonnementsflytning",
    heading: "Besked om abonnementsflytning",
    intro:
      "Sendes til kunder (valgfrit) ved optimering af abonnementers ugerytme.",
    editable: true,
    subjects: [
      {
        label: "E-mail emne",
        name: "subscription_defrag_notification_email_subject",
        val: "Vi har ændret ugen for levering af service på dit abonnement",
      },
    ],
    body: `Kære {{kunde_fornavn}}

Vi har optimeret vores ruter for at begrænse kørslen og dermed passe bedre på miljøet. Derfor har vi været nødsaget til at flytte tidspunktet for levering af service på adressen {{leverings_adresse}}.

Før flytningen ville du modtage service i uge {{næste_tre_uger_før_optimering}}, osv. Nu vil du i stedet modtage service i uge {{næste_tre_uger_efter_optimering}}, osv. Dvs. tidspunktet er flyttet {{flyttet_antal_uger}}.

Næste gang er planlagt til {{naeste_gang_uge_med_dato_interval}}

Tak for forståelsen og tak fordi du er kunde hos os.

De bedste hilsner
{{dit_firmanavn}}`,
    smsSender: "Service SMS",
    variables: [
      {
        token: "{{kunde_fornavn}}",
        desc: "Dette er fornavnet på kunden, hvilket svarer til det første ord i navnefeltet(Hvis kunden er et firma benyttes første ord i att. navnefeltet)",
      },
      {
        token: "{{kunde_fuldt_navn}}",
        desc: "Dette er det fulde navn på kunden, som indtastet i navnefeltet(Hvis kunden er et firma benyttes att. navnefeltet)",
      },
      {
        token: "{{dit_firmanavn}}",
        desc: "Dette er navnet på din virksomhed",
      },
      {
        token: "{{dit_telefonnummer}}",
        desc: "Dette er telefonnummeret på din virksomhed",
      },
      {
        token: "{{din_email}}",
        desc: "Dette er e-mail adressen på din virksomhed",
      },
      {
        token: "{{leverings_adresse}}",
        desc: "Dette er abonnementets leveringsadresse",
      },
      {
        token: "{{næste_tre_uger_før_optimering}}",
        desc: "Dette er de næste tre uger for aboennementet som det har været indtil nu, altså før optimeringen",
      },
      {
        token: "{{næste_tre_uger_efter_optimering}}",
        desc: "Dette er de næste tre uger for aboennementet som det bliver fremover, altså efter optimeringen",
      },
      {
        token: "{{flyttet_antal_uger}}",
        desc: "Dette er antallet af uger aboennementet er blevet flyttet som en del af optimeringen",
      },
      {
        token: "{{naeste_gang_uge_med_dato_interval}}",
        desc: "Dette er ugenummeret, hvor kunden skal have service næste gang (med dato interval)",
      },
      {
        token: "{{naeste_gang_uge_uden_dato_interval}}",
        desc: "Dette er ugenummeret, hvor kunden skal have service næste gang (uden dato interval)",
      },
    ],
    maxSubject: 100,
  },
  {
    key: "order-confirmation",
    menuLabel: "Ordrebekræftelse",
    heading: "Ordrebekræftelse",
    intro:
      "Sendes til kunder ifm. online bestilling eller ved oprettelse/redigering af en manuel ordre.",
    editable: false,
    subjects: [],
    variables: [],
    stubText:
      "På nuværende tidspunkt er det ikke muligt at tilpasse teksten for denne e-mail.",
  },
  {
    key: "order-reminder",
    menuLabel: "Påmindelse om genbestilling",
    heading: "Påmindelse om genbestilling",
    intro:
      "Sendes til online kunder X dage efter senest afsluttede ordre. Sendes kun på baggrund af online ordrer (ikke manuelle ordrer eller abonnementskunder).",
    editable: false,
    subjects: [],
    variables: [],
    stubText:
      "På nuværende tidspunkt er det ikke muligt at tilpasse teksten for denne e-mail.",
  },
  {
    key: "invoice",
    menuLabel: "Fakturaafsendelse",
    heading: "Fakturaafsendelse",
    intro:
      "Karltoffel kan sende faktura til dine kunder, når du afslutter en ordre, forudsat at du anvender et eksternt regnskabssystem, som Karltoffel kan integrere med, f.eks. Dinero. Selve fakturaen bliver ikke udstedt af Karltoffel, men af det eksterne regnskabssystem. Karltoffel vedhæfter blot fakturaen til beskeden og sender den til kunden.\n\nHvis du anvender Dinero, så kan du tilpasse skabelonen / beskeden, der bliver sendt til kunden inde i Dinero. Log ind i Dinero og gå til Indstillinger > Sprog > Udsendelse > Fakturaudsendelse. Her kan du redigere teksten, som anvendes til både e-mail og SMS.\n\nVær obs på, at det koster alm. SMS takst at sende faktura via SMS, og at længden på beskeden påvirker, hvor mange SMS'er, der forbruges per faktura.",
    editable: false,
    subjects: [],
    variables: [],
    delegatesTo: "Dinero",
  },
  {
    key: "price-adjustment",
    menuLabel: "Prisjustering",
    heading: "Besked om prisjustering",
    intro:
      "Sendes til kunder (hvis valgt for prisjusteringen), når en prisjustering igangsættes.",
    editable: true,
    subjects: [
      {
        label: "E-mail emne",
        name: "price_adjustment_notification_email_subject",
        val: "Opdatering af dine priser",
      },
    ],
    body: `Kære {{kunde_fornavn}}

Vi ønsker at informere dig om, at dine priser justeres pr. {{ikrafttraedelse_dato}}, som følger: 

{{opgave_liste}}

Justeringen skyldes generelle omkostningsstigninger samt vores mål om fortsat at levere høj kvalitet og god service.

Har du spørgsmål, er du altid velkommen til at kontakte os.

Vi glæder os til at fortsætte samarbejdet med dig.

De bedste hilsner
{{dit_firmanavn}}`,
    smsSender: "Service SMS",
    variables: [
      {
        token: "{{kunde_fornavn}}",
        desc: "Dette er fornavnet på kunden, hvilket svarer til det første ord i navnefeltet(Hvis kunden er et firma benyttes første ord i att. navnefeltet)",
      },
      {
        token: "{{kunde_fuldt_navn}}",
        desc: "Dette er det fulde navn på kunden, som indtastet i navnefeltet(Hvis kunden er et firma benyttes att. navnefeltet)",
      },
      {
        token: "{{dit_firmanavn}}",
        desc: "Dette er navnet på din virksomhed",
      },
      {
        token: "{{dit_telefonnummer}}",
        desc: "Dette er telefonnummeret på din virksomhed",
      },
      {
        token: "{{din_email}}",
        desc: "Dette er e-mail adressen på din virksomhed",
      },
      {
        token: "{{leverings_adresse}}",
        desc: "Leveringsadresse for de berørte opgaver",
      },
      {
        token: "{{opgave_liste}}",
        desc: "Dette er en liste over de opgaver, der bliver prisjusteret. Det anvendte format vælges, når du opretter prisjusteringen.",
      },
      {
        token: "{{ikrafttraedelse_dato}}",
        desc: "Tidspunktet hvor prisjusteringen træder i kraft",
      },
      {
        token: "{{ikrafttraedelse_uge_uden_ugedag}}",
        desc: "Tidspunktet hvor prisjusteringen træder i kraft",
      },
      {
        token: "{{ikrafttraedelse_uge_med_ugedag}}",
        desc: "Tidspunktet hvor prisjusteringen træder i kraft",
      },
    ],
    maxSubject: 50,
  },
  {
    key: "tilbud",
    menuLabel: "Tilbudsmail",
    heading: "Tilbudsmail",
    intro:
      "Skabelon til det tilbud, du sender til en kunde på e-mail. Felterne herunder udfyldes automatisk ud fra kundens oplysninger og opgaverne på tilbuddet, når du sender fra en kunde eller en ordre.",
    editable: true,
    subjects: [
      {
        label: "E-mail emne",
        name: "tilbud_email_subject",
        val: "Tilbud på vinduespudsning – {{leverings_adresse}}",
      },
    ],
    body: `Kære {{kunde_fornavn}}

Tak for din henvendelse. Hermed vores tilbud på vinduespudsning på adressen {{leverings_adresse}}:

{{opgave_liste}}

Samlet pris pr. gang: {{tilbud_total}}
{{pris_moms_info}}

Prisen forudsætter fri adgang til alle vinduer på adressen. Ønsker du en fast aftale, sørger vi automatisk for, at dine vinduer altid står skarpe – uden at du skal løfte en finger, og du kan naturligvis til enhver tid sætte aftalen på pause eller opsige den.

Tilbuddet er gyldigt til og med {{tilbud_gyldig_til}}. Du accepterer nemt ved at besvare denne e-mail eller ringe til os på {{dit_telefonnummer}} – så aftaler vi første besøg.

Vi glæder os til at høre fra dig.

De bedste hilsner
{{dit_firmanavn}}
{{dit_telefonnummer}} · {{din_email}}`,
    smsSender: "Service SMS",
    variables: [
      { token: "{{kunde_fornavn}}", desc: "Fornavnet på kunden (første ord i navnefeltet; for firmaer bruges att.-navnet)." },
      { token: "{{leverings_adresse}}", desc: "Tilbuddets leveringsadresse (ordrens adresse, ellers kundens adresse)." },
      { token: "{{opgave_liste}}", desc: "Nummereret liste over opgaverne på tilbuddet med pris pr. linje." },
      { token: "{{tilbud_total}}", desc: "Samlet pris for opgaverne (inkl. moms)." },
      { token: "{{pris_moms_info}}", desc: "Fast tekst: at alle priser er inkl. moms." },
      { token: "{{tilbud_gyldig_til}}", desc: "Datoen tilbuddet er gyldigt til (30 dage fra afsendelse)." },
      { token: "{{dit_firmanavn}}", desc: "Navnet på din virksomhed." },
      { token: "{{dit_telefonnummer}}", desc: "Telefonnummeret på din virksomhed." },
      { token: "{{din_email}}", desc: "E-mailadressen på din virksomhed." },
    ],
    maxSubject: 100,
  },
  {
    key: "tilbud-opfoelgning",
    menuLabel: "Opfølgning på tilbud",
    heading: "Opfølgning på tilbud",
    intro:
      "Skabelon til en venlig opfølgning på et tidligere fremsendt tilbud, som kunden endnu ikke har svaret på.",
    editable: true,
    subjects: [
      {
        label: "E-mail emne",
        name: "tilbud_opfoelgning_email_subject",
        val: "Har du haft tid til at kigge på vores tilbud?",
      },
    ],
    body: `Kære {{kunde_fornavn}}

Vi sendte dig for nylig et tilbud på vinduespudsning på adressen {{leverings_adresse}} og ville blot høre, om du har haft mulighed for at kigge på det.

Kort opsummeret tilbød vi:

{{opgave_liste}}

Samlet pris pr. gang: {{tilbud_total}}
{{pris_moms_info}}

Tilbuddet gælder til og med {{tilbud_gyldig_til}}. Har du spørgsmål, eller ønsker du at justere opgaverne, så svar blot på denne e-mail eller ring til os på {{dit_telefonnummer}} – så finder vi en løsning, der passer dig.

Tak fordi du overvejer os.

De bedste hilsner
{{dit_firmanavn}}
{{dit_telefonnummer}} · {{din_email}}`,
    smsSender: "Service SMS",
    variables: [
      { token: "{{kunde_fornavn}}", desc: "Fornavnet på kunden (første ord i navnefeltet; for firmaer bruges att.-navnet)." },
      { token: "{{leverings_adresse}}", desc: "Tilbuddets leveringsadresse (ordrens adresse, ellers kundens adresse)." },
      { token: "{{opgave_liste}}", desc: "Nummereret liste over opgaverne på tilbuddet med pris pr. linje." },
      { token: "{{tilbud_total}}", desc: "Samlet pris for opgaverne (inkl. moms)." },
      { token: "{{pris_moms_info}}", desc: "Fast tekst: at alle priser er inkl. moms." },
      { token: "{{tilbud_gyldig_til}}", desc: "Datoen tilbuddet er gyldigt til." },
      { token: "{{dit_firmanavn}}", desc: "Navnet på din virksomhed." },
      { token: "{{dit_telefonnummer}}", desc: "Telefonnummeret på din virksomhed." },
      { token: "{{din_email}}", desc: "E-mailadressen på din virksomhed." },
    ],
    maxSubject: 100,
  },
];
