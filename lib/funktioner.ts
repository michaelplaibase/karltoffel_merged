import type { SField } from "./settings-config";

export type FSection = { h?: string; fields: SField[] };

export const GROUP_MESSAGES: {
  title: string; purpose: string;
  historyCols: string[]; historyEmpty: string;
  createTitle: string; createIntro: string;
  fields: SField[]; sendLabel: string;
} = {
  title: "Oversigt over gruppebeskeder",
  purpose: "Oversigten viser historik over manuelt afsendte gruppebeskeder.",
  historyCols: ["Besked-nr", "Sendt som", "Modtagere", "E-mail emne", "Besked", "Tidspunkt", "Status"],
  historyEmpty: "No matching records found",
  createTitle: "Send gruppebesked",
  createIntro:
    "Her kan du sende en gruppebesked via e-mail og SMS til en eller flere af dine kunder. Funktionen er beregnet til driftsmæssig kommunikation med eksisterende kunder, f.eks. servicebeskeder. Funktionen må ikke anvendes til marketing, reklame eller lign. med mindre du selv har indhentet samtygge jf. dansk lovgivning.",
  fields: [
    {
      t: "select",
      l: "Kundegruppe",
      opts: [
        "Alle ordrer på en bestemt dato",
        "Alle ordrer i en bestemt uge",
        "Alle ikke-afsluttede ordrer på en bestemt dato",
        "Alle ikke-afsluttede ordrer i en bestemt uge",
        "Alle abonnementskunder",
        "Alle online kunder (uden abonnement)",
        "Alle manuelle kunder (uden abonnement)",
        "Alle manuelle kunder og online kunder (uden abonnement)",
        "Alle aktive kunder i kartotek",
      ],
      help: "Vælg hvilken gruppe af kunder, der skal modtage beskeden",
    },
    {
      t: "date",
      l: "Dato",
      help: "Beskeden sendes til de kunder, der har en ordre i kalenderen på den valgte dato",
    },
    {
      t: "select",
      l: "Uge",
      opts: ["Uge 27, 2026 (indeværende uge)", "… (13 uger)"],
      help: "Beskeden sendes til de kunder, der har en ordre i kalenderen i den valgte uge",
    },
    {
      t: "select",
      l: "Medarbejder",
      opts: ["Alle medarbejdere", "Kristian Klercke"],
      val: "Alle medarbejdere",
      help: "Beskeden sendes til de kunder, der har en ordre i den valgte medarbejders kalender",
    },
    {
      t: "select",
      l: "Send besked som",
      opts: [
        "Både SMS og e-mail",
        "Kun som SMS",
        "Kun som e-mail",
        "Som e-mail, hvis kunden har en email-adr., ellers som SMS",
      ],
    },
    { t: "text", l: "E-mail emne", help: "(anvendes ikke til SMS)" },
    { t: "textarea", l: "Besked", help: "Beskeden, som skal sendes" },
    {
      t: "text",
      l: "Afsender på SMS",
      val: "Service SMS",
      ro: true,
      help: "Afsender på SMS. Kan være tekst eller dit mobilnummer. Maks 11 karakterer. Kontakt Fenster Support for at få feltet ændret (kræver Fenster Premium abonnement)",
    },
    {
      t: "buttons",
      l: "Send en test",
      btns: [["Send test e-mail", "outline-primary"], ["Send test SMS", "light"]],
    },
  ],
  sendLabel: "Send besked til kundegruppen",
};

export const HOLIDAYS: {
  title: string; warning: string; body: string;
  bullets: string[]; example: string[];
  historyCols: string[]; historyEmpty: string;
  createTitle: string; fields: SField[]; saveLabel: string;
} = {
  title: "Ferieplanlægning",
  warning:
    "Det er vigtigt, at du forstår, hvordan ferieplanlægningen virker, inden du tager den i brug, da ferieplanlægningen direkte påvirker din kalender, alle dine abonnementer samt relaterede ordrer.",
  body:
    "Når du indtaster en ferie vil kalenderen blive lukket i de pågældende uger, og alle abonnementsordrer fra dit kartotek blive skubbet frem i tid startende fra ferietidspunktet. Dvs. det er ikke kun ordrer i ferieperioden, der vil blive skubbet, men også ordrer fra alle efterfølgende uger vil blive skubbet frem i tid.",
  bullets: [
    "Du skal oprette en ferie minimum 1 uge før ferien påbegyndes",
    "Du kan ikke redigere eller slette en ferie, når der er mindre end 1 uge til ferien påbegyndes",
    "Ferieplanlægning gælder for alle medarbejdere i virksomheden",
    "Det er kun abonnementsordrer, der bliver skubbet frem i tid (manuelle ordrer og online ordrer skal du selv håndtere)",
    "Kunderne bliver ikke automatisk orienteret om, at du holder ferie (det skal du selv gøre)",
    "Hvis du tidligere har flyttet en abonnementsordre til en anden uge, end den oprindeligt var planlagt til, så vil ordren falde tilbage til sin normale placering/interval, når ferien bliver oprettet (såfremt den ligger efter ferietidspunktet)",
    "Du kan oprette ekstra arbejdstid oven i ferien, hvis du har nogle enkelte ordrer, der skal planlægges/leveres. Dette gøres ved at trække-slippe og så oprette ekstra arbejdstid",
  ],
  example: [
    "Du opretter ferie i uge 23-24",
    "Et 8-ugers abonnement, der normalt ville ligge i uge 12, 20, 28, 36, vil nu blive skubbet 2 uger frem fra ferietidspunktet, og vil derfor ligge med ordrer i uge 12, 20, 30, 38",
    "Et 8-ugers abonnement, der normalt ville ligge i uge 12, 20, 29*, 36 (*fordi du tidligere har flyttet ordren fra uge 28 til uge 29), vil ligge med ordrer i uge 12, 20, 30, 38",
    "En online ordre, der ligger i uge 23 vil ligge uændret i uge 23",
    "En manuel, ikke-fastlåst ordre, der ligger i uge 23, vil blive liggende i ugen, men planlægningen vil fejle, fordi der er ferielukket. (Opret ekstra arbejdstid eller flyt ordren til en anden uge).",
  ],
  historyCols: ["Ferienr.", "Ferieperiode (inklusiv)", "Kan redigeres til og med"],
  historyEmpty: "Ingen planlagte ferier",
  createTitle: "Opret ferie",
  fields: [
    {
      t: "select",
      l: "Startuge",
      opts: ["Uge 29, 2026", "Uge 30, 2026", "… (~50 uger frem til Uge 26, 2027)"],
    },
    {
      t: "select",
      l: "Slutuge",
      opts: ["Uge 29, 2026", "Uge 30, 2026", "… (~50 uger frem til Uge 26, 2027)"],
    },
  ],
  saveLabel: "Gem ferie",
};

export const OPTIMIZATION: {
  title: string; gate: string; intro: string[];
  disabledTitle: string; disabledMsg: string; dialogNote: string;
} = {
  title: "Abonnementsoptimering",
  gate: "Premium",
  intro: [
    "Abonnementsoptimering er en avanceret funktion, som kan hjælpe med at optimere din kørsel ved at flytte udvalgte abonnementer, dvs. ved at forskubbe ugerytmen.",
    "Venstre kort viser den nuværende ugerytmer for alle dine abonnementer, mens det højre kort viser ugerytmerne efter optimering.",
    "Optimeringen tager også højde for fordeling af arbejdestid på tværs af uger, således at arbejdstiden jævnes ud.",
    "Fenster foreslår flytning af op til 10 abonnementer ad gangen, hvor du skal bekræfte for hvert abonnement, om det må flyttes. Når flytningen er gennemført sender Fenster en besked til kunden med info om ændringen. Du kan tilpasse beskeden på denne side, hvis du ønsker det.",
  ],
  disabledTitle: "Abonnementsoptimering er deaktiveret",
  disabledMsg:
    "Det kræver min. 100 abonnementer at udføre abonnementsoptimering. Der er pt. 5 abonnementer i kartoteket.",
  dialogNote: `Dialog "Bekræft flytning af abonnementer": vælg hvordan kunderne informeres om ændringen — "Både SMS og e-mail", "Kun som SMS", "Kun som e-mail", "Som e-mail, hvis kunden har en email-adr., ellers som SMS" eller "Giv ikke besked". Advarsel: "Denne handling kan ikke fortrydes." Knapper: "Luk" / "Flyt abonnementer".`,
};

export const PRICE_ADJUSTMENT: {
  title: string; steps: string[];
  sections: FSection[]; submitLabel: string;
} = {
  title: "Prisjustering",
  steps: ["Indstillinger", "Tilpas opgaver", "Bekræft og sæt i gang"],
  sections: [
    {
      h: "Tidspunkt",
      fields: [
        {
          t: "select",
          l: "Vælg, hvornår prisjusteringen skal træde i kraft",
          opts: ["Mandag uge 29 (13/7-2026)", "Mandag uge 30 (20/7-2026)", "… (~52 mandage frem til Mandag uge 27 (5/7-2027))"],
          help: "Tidspunktet, hvor justeringen gennemføres og priserne opdateres",
        },
      ],
    },
    {
      h: "Størrelse",
      fields: [
        {
          t: "radio",
          opts: [
            "Procentuel justering (%)",
            "Procentuel justering baseret på opgavens timepris",
          ],
        },
        {
          t: "note",
          val: `Timepris-baseret justering: tabel med 5 bånd, hver med eget procent-input og redigerbare grænser (standard 400 / 600 / 800 / 1000 kr/time): "Mindre end 400 kr/time", "Fra 400 til 600 kr/time", "Fra 600 til 800 kr/time", "Fra 800 til 1000 kr/time", "Mere end 1000 kr/time".`,
        },
      ],
    },
    {
      h: "Afrunding",
      fields: [
        {
          t: "select",
          l: "Vælg, om den nye pris skal afrundes",
          opts: [
            "Ingen afrunding",
            "50 øre",
            "1 kr.",
            "2 kr.",
            "5 kr.",
            "Slut på 9,00 kr.",
            "Slut på 9,95 kr.",
            "10 kr.",
          ],
          val: "Ingen afrunding",
          help: "Vælg fra listen for at se eksempler på afrunding",
        },
      ],
    },
    {
      h: "Kundegrundlag",
      fields: [
        {
          t: "select",
          l: "Aftaletype",
          opts: [
            "Juster både abonnementer og fastprisaftaler",
            "Juster kun abonnementer",
            "Juster kun fastprisaftaler",
          ],
        },
        {
          t: "select",
          l: "Ekskludér kunder med opgaver, der er prisjusteret inden for",
          opts: ["den sidste måned", "de sidste 2 mdr.", "de sidste 3 mdr.", "de sidste 4 mdr.", "de sidste 6 mdr.", "de sidste 9 mdr.", "de sidste 12 mdr.", "de sidste 18 mdr.", "de sidste 24 mdr.", "de sidste 36 mdr."],
        },
        {
          t: "select",
          l: "Ekskludér kunder med opgaver, der er oprettet inden for",
          opts: ["den sidste måned", "de sidste 2 mdr.", "de sidste 3 mdr.", "de sidste 4 mdr.", "de sidste 6 mdr.", "de sidste 9 mdr.", "de sidste 12 mdr.", "de sidste 18 mdr.", "de sidste 24 mdr.", "de sidste 36 mdr."],
        },
        {
          t: "select",
          l: "Ekskludér kunder med opgaver, hvor prisen manuelt er ændret inden for",
          opts: ["den sidste måned", "de sidste 2 mdr.", "de sidste 3 mdr.", "de sidste 4 mdr.", "de sidste 6 mdr.", "de sidste 9 mdr.", "de sidste 12 mdr.", "de sidste 18 mdr.", "de sidste 24 mdr.", "de sidste 36 mdr."],
        },
        {
          t: "note",
          val: "Kundegrundlaget medtages til næste side, hvor du kan fravælge specifikke kunder og tilpasse priser manuelt.",
        },
      ],
    },
    {
      h: "Kundekommunikation",
      fields: [
        {
          t: "note",
          val: "Kunderne modtager besked via e-mail/SMS, når prisjusteringen bekræftes og igangsættes. Du kan tilpasse beskeden via denne skabelon (åbner i nyt vindue).",
        },
        {
          t: "select",
          l: "Send besked som",
          opts: [
            "Både SMS og e-mail",
            "Kun som SMS",
            "Kun som e-mail",
            "Som e-mail hvis kunden har en email-adr, ellers som SMS",
            "Send ikke besked",
          ],
        },
        {
          t: "radio",
          l: "Vælg hvilke detaljer om prisændringen, der skal indgå i beskeden:",
          opts: [
            "Oplys om prisændringen for hver opgave",
            "Oplys om prisen før og efter for hver opgave",
            "Oplys om ny pris for hver opgave",
          ],
          help: `F.eks. "Udvendig polering +25,00 kr." / "Udvendig polering, før 250 kr., ny pris 275 kr." / "Udvendig polering, ny pris 275 kr."`,
        },
        {
          t: "select",
          l: "Fravælg besked til kunder, som har en fastprisaftale, der ikke har været anvendt",
          opts: ["Nej", "de sidste 3 måneder", "de sidste 6 måneder", "de sidste 9 måneder", "de sidste 12 måneder", "de sidste 15 måneder", "de sidste 18 måneder", "de sidste 24 måneder", "de sidste 36 måneder"],
          val: "Nej",
        },
      ],
    },
  ],
  submitLabel: "Gå videre (kan ikke fortrydes)",
};
