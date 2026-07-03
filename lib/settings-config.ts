export type SField = {
  t: "text" | "number" | "date" | "textarea" | "color" | "select" | "checks" | "radio" | "toggle" | "static" | "note" | "buttons" | "subtable";
  l?: string;            // Danish label
  val?: string;          // current/default value
  opts?: string[];       // options for select/checks/radio
  on?: number | number[];// selected radio index, or checked checks indices
  help?: string;         // grey help text (Danish)
  ro?: boolean;          // read-only
  btns?: [string, string][]; // [label, variant] pairs for t:"buttons" (variant: "primary"|"outline-primary"|"light"|"danger"|"outline-secondary"|"sub")
  cols?: string[];       // column headers for t:"subtable"
  rows?: string[][];     // rows for t:"subtable"
  empty?: string;        // empty-state text for t:"subtable"
};
export type SSection = { h?: string; fields: SField[] };
export type SPage = { title: string; route: string; purpose?: string; saveLabel?: string; noSave?: boolean; sections: SSection[] };
export const SETTINGS_PAGES: Record<string, SPage> = {
  "/settings": {
    title: "Indstillinger",
    route: "/settings",
    purpose: "Centrale kontoindstillinger: SMS-godkendelse, kundenotifikationer, fakturering, 'Afslut ordre'-forudindstillinger, online bestilling, timepriser og tilpasning af tids-/prisberegner.",
    saveLabel: "Gem alle ændringer",
    sections: [
      {
        h: "Fenster konto",
        fields: [
          { t: "note", val: "Indstillinger vedr. din Fenster konto, f.eks. virksomhedsoplysninger, dit Fenster abonnement, kapacitetsforbrug, betalingsoplysninger, fakturahistorik, mv." },
          { t: "buttons", btns: [["Åbn Fenster konto side ...", "outline-primary"]] },
        ],
      },
      {
        h: "Diverse",
        fields: [
          { t: "note", val: "SMS-afsendelse er aktiveret for kontoen. Alle funktioner er tilgængelige — der kræves ikke noget abonnement." },
        ],
      },
      {
        h: "Notifikationer",
        fields: [
          { t: "note", val: "Du kan sende notifikationer til dine kunder før og efter levering af din service. Indstillingerne gælder for alle ordretyper, med undtagelse af online ordrer, hvor der ikke sendes notifikation før og efter levering. Du kan overskrive indstillingerne på det enkelte kundeabonnement... Notifikationer sendes til kontakten på leveringsadressen." },
          { t: "checks", l: "Send notifikationer via", opts: ["SMS", "E-mail"], help: "Vælg om notifikationer sendes via SMS og/eller e-mail." },
          { t: "select", l: "Send notifikation før levering, når 'Kunden skal være tilstede'", opts: ["Nej, send ikke", "Ja, med dato", "Ja, med dato og tidsinterval (-1t → +2t)", "Ja, med dato og tidsinterval (-1t → +1t)", "Ja, med dato og klokkeslæt"], val: "Nej, send ikke", help: "Vælg 'Nej', hvis du ikke vil sende notifikation før levering. Alternativt, vælg hvordan du vil oplyse om leveringstidspunkt, når opgaverne kræver, at kunden skal være tilstede." },
          { t: "number", l: "Vælg antal dage notifikationen skal sendes før levering, når en eller flere opgaver på ordren kræver [tilstedeværelse]", val: "3", help: "Skriv hvor mange dage før leveringstidspunktet, at kunden skal modtage en notifikation..." },
          { t: "select", l: "Send notifikation før levering, når 'Kunden ikke behøver at være tilstede'", opts: ["Nej, send ikke", "Ja, med dato", "Ja, med dato og tidsinterval (-1t → +2t)", "Ja, med dato og tidsinterval (-1t → +1t)", "Ja, med dato og klokkeslæt"], val: "Nej, send ikke", help: "Vælg 'Nej', hvis du ikke vil sende notifikation før levering. Alternativt, vælg hvordan du vil oplyse om leveringstidspunkt, når opgaverne kræver, at kunden skal være tilstede." },
          { t: "number", l: "Vælg antal dage notifikationen skal sendes før levering, når ingen af opgaverne på ordren kræver [tilstedeværelse]", val: "3", help: "Skriv hvor mange dage før leveringstidspunktet, at kunden skal modtage en notifikation..." },
          { t: "toggle", l: "Send notifikation efter levering", val: "Ja", on: 1, help: "Vælg om du ønsker at sende en notifikation til kunden efter levering, dvs. når ordrens leveringsstatus opdateres til udført (f.eks. når status meldes ind eller ordren afsluttes)." },
        ],
      },
      {
        h: "Fakturering",
        fields: [
          { t: "note", val: "Fenster kan sende faktura til dine kunder, forudsat du har aktiveret en integration til et regnskabsprogram, f.eks. Dinero." },
          { t: "checks", l: "Afsend faktura via", opts: ["SMS", "E-mail"], help: "Faktura udstedes altid af Dinero. Herefter varetager Dinero afsendelse via email, mens Fenster varetager afsendelse via SMS til gældende SMS priser." },
        ],
      },
      {
        h: "Afslut ordre",
        fields: [
          { t: "note", val: "Du kan vælge at lave standard forudindstillinger for felter på siden \"Afslut ordre\", således at du kan spare klik hver gang, du afslutter en ordre. Desuden kan du indstille TrustPilot AFS." },
          { t: "radio", l: "Forudindstilling for 'Leveringsstatus'", opts: ["Blank (ingen forudindstilling)", "Udført", "Anden status"], help: "Vælg hvordan sektionen \"Leveringsstatus\" på siden \"Afslut ordre\" skal forudindstilles som standard." },
          { t: "radio", l: "Forudindstilling for 'Betaling og fakturering'", opts: ["Blank (ingen forudindstilling)", "Send faktura - ubetalt", "Send faktura - betalt kontant", "Send ikke faktura fra Fenster", "Opret fakturakladde", "Registrer på et senere tidspunkt"], help: "Vælg hvordan sektionen \"Betaling og Fakturering\" på siden \"Afslut ordre\" skal forudindstilles som standard." },
          { t: "radio", l: "Forudindstilling for 'Betaling'", opts: ["Blank (ingen forudindstilling)", "Kontant", "MobilePay Get Paid", "Ikke betalt på adressen", "Registrer på et senere tidspunkt"], help: "Vælg hvordan sektionen \"Betaling\" på siden \"Afslut ordre\" skal forudindstilles som standard." },
          { t: "text", l: "Trustpilot AFS e-mail", val: "", help: "Indtast din unikke Trustpilot email adresse, såfremt du vil aktivere Trustpilot AFS... Når du afslutter en ordre, beder Fenster Trustpilot om at sende en e-mail til kunden med anmodning om en anmeldelse..." },
        ],
      },
      {
        h: "Online bestilling",
        fields: [
          { t: "toggle", l: "Anvend online bestilling", val: "Ja", on: 1, help: "Gør det muligt for dine kunder at bestille vinduespudsning online via din bestillingsside. Husk også at aktivere online bestilling på de enkelte medarbejdere." },
          { t: "text", l: "Web-adresse", val: "https://www.fenster.dk/krltfl", ro: true, help: "Web-adressen på bestillingsside, som dine kunder kan bruge. Du skal bruge adressen, hvis du f.eks. lægger en knap ind på din hjemmeside/facebook, eller som QR kode til en flyer." },
          { t: "buttons", btns: [["Følg adresse", "light"], ["Kopier adresse", "light"]] },
          { t: "number", l: "Bestillingsvarsel (timer)", val: "24", help: "...bestemmer, hvor mange timer der min. skal være mellem bestillings- og leveringstidspunkt. Standardværdien er 24 timer" },
          { t: "toggle", l: "Send påmindelse om genbestilling", val: "Ja", on: 1, help: "Sender en påmindelse til online kunder om at bestille igen efter X dage. Sendes kun pba online ordrer, ikke på baggrund af manuelle ordrer eller abonnementskunder." },
          { t: "number", l: "Send påmindelse antal dage efter afsluttet ordre", val: "60", help: "Antal dage der skal gå efter seneste ordre er afsluttet før påmindelse fremsendes til kunden." },
          { t: "toggle", l: "Deltag i online kundehenvisning", val: "Ja", on: 1, help: "Hvis en online kunde ligger uden for dit serviceområde, så henvises kunden til en anden Fenster Partner (i stedet for at blive afvist og gå tabt). Ligeledes vil du også modtage kundehenvisninger fra andre Fenster Partnere..." },
        ],
      },
      {
        h: "Timepriser",
        fields: [
          { t: "note", val: "Timepriser anvendes af Fenster til at estimere prisen på en ordre, f.eks. hvis du har valgt, at dine kunder kan bestille vinduespudsning online, eller hvis du vælger at gøre brug af prisberegneren, når du manuelt opretter en ordre i kalenderen." },
          { t: "number", l: "Timepris i Lokalområde", val: "600", help: "DKK inkl. moms og eks. kørsel" },
          { t: "note", val: "Hvert af dine områder er indtegnet på et kort i Fenster. Hvis du ønsker at tilføje eller ændre dine områder (f.eks. navn eller størrelse), så kontakt Fenster Support." },
        ],
      },
      {
        h: "Tilpasning af tids-/prisberegner",
        fields: [
          { t: "note", val: "Beregneren estimerer varighed og pris på en opgave. Teknik og hastighed varierer mellem vinduespudsere, så beregneren kan tilpasses din virksomhed: udfyld et spørgeskema (tager ca. 10-15 min), hvorefter Fenster Support lægger ændringerne ind og giver dig besked via email." },
          { t: "buttons", btns: [["Klik for at åbne spørgeskemaet", "light"]], help: "(åbner i nyt vindue)" },
        ],
      },
    ],
  },

  "/funnel-settings": {
    title: "Udseende",
    route: "/funnel-settings",
    purpose: "Branding og indhold på de kundevendte online bestillingssider og udgående e-mails: logo, farver, kommentartekster, handelsbetingelser, uden-for-område-besked og Google Ads konverteringstracking.",
    saveLabel: "Gem alle ændringer",
    sections: [
      {
        h: "Logo og grafik",
        fields: [
          { t: "note", val: "Sæt indstillinger for logo og grafik her. Anvendes bl.a. på din bestillingsside og til dine e-mails, f.eks. ordrebekræftelse, abonnementsbekræftelse m.fl." },
          { t: "text", l: "Logo højde", val: "60", help: "Dette angiver højden på dit logo i pixels. Anbefalet værdi ml. 50-150." },
          { t: "buttons", l: "Logo upload", btns: [["Vælg fil ...", "light"]], help: "Du kan anvende formaterne PNG, JPG og GIF. Logoet bør være mindre end 500 kilobytes... Efter upload lægger Fenster Support dit logo ind og giver dig besked via email." },
          { t: "static", l: "Nuværende logo", val: "(preview af nuværende logo)" },
          { t: "toggle", l: "Fjern grafik fra e-mails", help: "Fenster indsætter normalt grafik i dine e-mails, f.eks. med en glad, hoppende dame, og lign. Du har mulighed for at fjerne denne grafik her." },
        ],
      },
      {
        h: "Farver",
        fields: [
          { t: "note", val: "Vælg farverne til din bestillingsside og til dine emails, f.eks. ordrebekræftelse, abonnementsbekræftelse m.fl." },
          { t: "color", l: "Top farve", val: "#ffffff", help: "Baggrundsfarven øverst på siden, hvor logoet sidder; skal matche logoet." },
          { t: "color", l: "Primær farve", val: "#6ec0e5", help: "Farven på de store knapper nederst på bestillingssiderne og alle input-kanter; anbefalet en forholdsvis mørk farve." },
          { t: "color", l: "Sekundær farve", val: "#dae8f1", help: "Farven på den store opsummeringsboks og aktive/valgte inputs; anbefalet en forholdsvis lys farve." },
          { t: "color", l: "Tips o.a.", val: "#2484c6", help: "Farven på små spørgsmålstegn og badges, f.eks. \"billig kørsel\"-badges ved valg af tidspunkt; anbefalet en iøjnefaldende farve eller samme som primær." },
        ],
      },
      {
        h: "Tekster og kommentarer",
        fields: [
          { t: "text", l: "Pris-kommentar", val: "", help: "Eksempel: Prisen er inkl. materialer og gratis pudsning af altanglas, såfremt disse er nemt tilgængelige." },
          { t: "text", l: "Betalings-kommentar", val: "Faktura fremsendes efter udført service", help: "Eksempel: Faktura fremsendes efter udført service." },
          { t: "note", val: "Bemærk, at der er flere tekster, som kan tilpasses på bestillingssiderne, men det kun kan gøres med hjælp fra Fenster Support. Læs mere i Hjælpecenteret" },
        ],
      },
      {
        h: "Handelsbetingelser",
        fields: [
          { t: "note", val: "Handelsbetingelserne skal accepteres af kunderne ved online bestilling og kan også vedhæftes abonnementsbekræftelser. Du kan downloade en skabelon her. Handelsbetingelserne er altid dit eget ansvar." },
          { t: "textarea", l: "Handelsbetingelser", val: "Udfyld venligst dine Salg og leveringsbetingelser her." },
          { t: "buttons", btns: [["Se resultat", "light"]] },
        ],
      },
      {
        h: "Kører ikke på adressen",
        fields: [
          { t: "note", val: "Hvis kunden indtaster en adresse, som ligger uden for dit område, så vises denne besked. Undtaget hvis du deltager i \"online kundehenvisning\", så henvises kunden til en anden Fenster Partner, der kører på adressen." },
          { t: "textarea", l: "Kører ikke på adressen", val: "Beklager, men vi kører desværre ikke på din adresse" },
          { t: "buttons", btns: [["Se resultat", "light"]] },
        ],
      },
      {
        h: "Konverteringstracking",
        fields: [
          { t: "note", val: "Her kan du opsætte integration til Google Adwords... tracke (få besked), når en kunde konverterer i Fenster, dvs. når en kunde gennemfører en online bestilling. Tal evt. med dit markedsføringsbureau." },
          { t: "text", l: "Google Ads Global Site Tag", val: "", help: "Eksempel: AW-123456789." },
          { t: "text", l: "Google Ads Conversion Label", val: "", help: "Eksempel: p2w8CJWe_ZkBEJrl1vIC" },
          { t: "note", val: "Til øvrige tredjepartssystemer (Meta Pixel, Google Analytics) kan du bygge din egen \"Tak for bestillingen\"-side og bede Fenster Support omdirigere kunderne dertil efter gennemført online bestilling." },
        ],
      },
    ],
  },

  "/users": {
    title: "Brugere",
    route: "/users",
    purpose: "Administrer medarbejder-/brugerkonti: profil, kalenderfarve, rettigheder, planlægningsadresse samt login-genvej og kodeordsværktøjer — og opret nye brugere.",
    saveLabel: "Gem alle ændringer",
    sections: [
      {
        h: "Kristian Klercke",
        fields: [
          { t: "text", l: "Brugernavn", val: "kristianklercke" },
          { t: "text", l: "Fornavn", val: "Kristian" },
          { t: "text", l: "Efternavn", val: "Klercke" },
          { t: "text", l: "E-mail (valgfrit)", val: "k@klerckegroup.dk" },
          { t: "select", l: "Kalenderfarve", opts: ["Blå", "Brungrøn", "Grøn", "Lyserød", "Lavendel", "Beige", "Grå", "Lilla", "Tyrkis", "Lyselilla", "Fersken", "Gul", "Rosa"], val: "Blå" },
          { t: "static", l: "Aktiv kalender", val: "Ja", ro: true, help: "Brugere med en aktiv kalender indgår i den automatiske planlægning." },
          { t: "select", l: "Kan modtage online bestillinger", opts: ["Ja", "Nej"], val: "Nej", help: "Brugeren kan modtage online bestillinger i sin kalender, forudsat at online booking er aktiveret for virksomheden" },
          { t: "text", l: "Hjemmeadresse", val: "Mølbjerg 9, 8700 Horsens", help: "Hjemmeadresse anvendes af den automatiske planlægning af første og sidste ordre på dagen." },
          { t: "select", l: "Adresser i dagsprogrammet åbnes som", opts: ["Adressesøgning", "Rutevejledning"], val: "Rutevejledning", help: "Adresser i dagsprogrammet åbnes i Google maps enten som adressesøgning eller rutevejledning." },
          { t: "checks", l: "Rettigheder", opts: ["Portal admin (har alle rettigheder)", "Må se priser og omsætning", "Må redigere order og abonnementer", "Må håndtere betaling / fakturering", "Må ændre valgmulighed for betaling / fakturering"], on: [0, 1, 2, 3, 4] },
          { t: "buttons", l: "Login-genvej", btns: [["Åbn i nyt vindue", "light"], ["Kopier login-genvej", "light"]], help: "Login-genvejen anvendes til installation af app på f.eks. mobil. Følg instruks i hjælpevideo." },
          { t: "buttons", l: "Link til at ændre kodeord", btns: [["Kopier link til at ændre kodeord", "light"]], help: "...så du f.eks. kan sende til medarbejder, som har glemt sit kodeord" },
          { t: "buttons", l: "Installer Fenster på brugerens mobil", btns: [["Se og kopier vejledning", "outline-primary"]], help: "Brug knappen til at kopiere en vejledning, som du efterfølgende kan sende til medarbejderen" },
        ],
      },
      {
        h: "Ny bruger",
        fields: [
          { t: "note", val: "Du kan oprette lige så mange brugere, du vil — der er ingen begrænsning og ingen ekstra omkostning. Husk at indstille arbejdstider for brugeren, når denne er oprettet. Klik på 'Gem alle ændringer' for at oprette brugeren." },
          { t: "buttons", btns: [["Opret ny bruger", "primary"]] },
        ],
      },
    ],
  },

  "/working-hours": {
    title: "Arbejdstider",
    route: "/working-hours",
    purpose: "Definér kalenderens åbningstider per medarbejder per ugedag, plus to globale indstillinger (automatisk lukning på helligdage og fleksibel arbejdstid), der fodrer den automatiske planlægning.",
    saveLabel: "Gem alle ændringer",
    sections: [
      {
        h: "Generelle indstillinger",
        fields: [
          { t: "toggle", l: "Luk automatisk kalenderen på helligdage", val: "Ja", on: 1, help: "Hvis valgt, vil officielle danske helligdage automatisk være lukket i kalenderen, f.eks. 2. påskedag." },
          { t: "toggle", l: "Benyt fleksibel arbejdstid", val: "Ja", on: 1, help: "Fleksibel arbejdstid giver Fenster mulighed for at tage ekstra arbejdstid i brug sidst på dagen, såfremt det medfører en forholdsmæssig besparelse på kørslen, eller hvis ugen er fyldt op med ordrer. Fleksibel arbejdstid anbefales for de fleste..." },
        ],
      },
      {
        h: "Indstillinger per medarbejder",
        fields: [
          { t: "note", val: "Arbejdstiderne indstilles individuelt for hver medarbejder i virksomheden." },
          {
            t: "subtable",
            l: "Kristian Klercke",
            cols: ["Ugedag", "Aktiv", "Fra", "Til", "Flekstid"],
            rows: [
              ["Mandag", "Ja", "08:00", "16:00", ""],
              ["Tirsdag", "Ja", "08:00", "16:00", ""],
              ["Onsdag", "Ja", "08:00", "16:00", ""],
              ["Torsdag", "Ja", "08:00", "16:00", ""],
              ["Fredag", "Ja", "08:00", "16:00", ""],
              ["Lørdag", "", "", "", ""],
              ["Søndag", "", "", "", ""],
            ],
          },
          { t: "note", val: "Flekstid-valgmuligheder per dag: (blank), +30 min, +1 time, +1½ time, +2 timer, +3 timer, +4 timer, +5 timer, +6 timer." },
        ],
      },
    ],
  },

  "/planning-settings": {
    title: "Planlægning",
    route: "/planning-settings",
    purpose: "På denne side kan du foretage indstillinger, der påvirker Fensters automatiske kalenderplanlægning.",
    saveLabel: "Gem alle ændringer",
    sections: [
      {
        h: "Generelle indstillinger",
        fields: [
          { t: "buttons", l: "Benyt fleksibel arbejdstid", btns: [["Gå til indstilling", "light"]], help: "Fleksibel arbejdstid giver Fenster mulighed for at tage ekstra arbejdstid i brug sidst på dagen, såfremt det medfører en forholdsmæssig besparelse på kørslen, eller hvis ugen er fyldt op med ordrer. Fleksibel arbejdstid anbefales for de fleste..." },
        ],
      },
      {
        h: "Kristian Klercke",
        fields: [
          { t: "checks", opts: ["Udelad kørsel før første ordre på dagen", "Udelad kørsel efter sidste ordre på dagen", "Tilstræb at starte dagen længst væk fra hjemmeadressen"], on: [0, 1, 2], help: "Vælg dette, hvis du vil undgå, at Fenster planlægger kørsel til første ordre / kørsel hjem fra sidste ordre inden for arbejdstiden, eller hvis du ønsker at bruge de tidlige morgentimer på transport." },
          { t: "select", l: "Tilladte opgavekategorier", val: "Alle", opts: ["Alle", "Vinduespudsning", "Rentvandsvask", "Tagrenderens", "Overfladerens", "Algebehandling", "Overfladebeskyttelse", "Privatrengøring", "Ejendomsrengøring", "Viceværtservice", "Grøn service", "Ukrudtsbekæmpelse", "Skadedyrsbekæmpelse", "Bilpleje", "Administrativt", "Andet"], help: "Vælg hvilke opgavekategorier, som medarbejderen kan håndtere. For at en ordre kan planlægges i en medarbejders kalender, skal medarbejderen kunne håndtere alle kategorier på ordren. Hvis du fastgør en ordre eller et abonnement til en bestemt medarbejder, så vil ordren blive planlagt til denne medarbejder uagtet de tilladte opgavekategorier." },
        ],
      },
    ],
  },

  "/discount-codes": {
    title: "Rabatkoder",
    route: "/discount-codes",
    purpose: "Vis og administrer procentvise rabatkoder, som kunder kan anvende ved online bestilling.",
    noSave: true,
    sections: [
      {
        fields: [
          { t: "note", val: "Rabatkoder kan anvendes af kunder ved online bestilling." },
          { t: "buttons", btns: [["Opret ny rabatkode", "primary"]] },
          { t: "subtable", cols: ["Rabatkode", "Procentsats", "Udløbsdato", "Slet"], rows: [], empty: "No matching records found" },
        ],
      },
      {
        h: "Opret rabatkode",
        fields: [
          { t: "text", l: "Rabatkode" },
          { t: "number", l: "Procentsats" },
          { t: "date", l: "Slutdato" },
          { t: "buttons", btns: [["Luk", "light"], ["Gem rabatkode", "primary"]] },
        ],
      },
    ],
  },

  "/standard-tasks": {
    title: "Oversigt over standardopgaver",
    route: "/standard-tasks",
    purpose: "Oversigten viser alle dine standardopgaver. Når du redigerer en standardopgave, så slår ændringen igennem alle steder, hvor standardopgaven er i brug.",
    noSave: true,
    sections: [
      {
        fields: [
          { t: "buttons", btns: [["Opret ny standardopgave", "primary"]] },
          { t: "text", l: "Søg", val: "", help: "beskrivelse, kategori, bogstav" },
          { t: "checks", opts: ["Vis også deaktive standardopgaver"] },
          {
            t: "subtable",
            cols: ["", "Kategori", "Beskrivelse", "Kunden skal være tilstede"],
            rows: [
              ["", "Vinduespudsning", "Pudsning udvendig", ""],
              ["", "Vinduespudsning", "Pudsning indvendig", "Ja"],
              ["", "Tagrenderens", "Rensning af tagrender", ""],
              ["", "Privatrengøring", "Hovedrengøring", ""],
              ["", "Administrativt", "Møde", ""],
            ],
          },
          { t: "note", val: "146 opgaver i 15 kategorier; systemopgaver er låst og kan hverken redigeres eller deaktiveres." },
        ],
      },
    ],
  },

  "/accounting": {
    title: "Regnskab",
    route: "/accounting",
    purpose: "Skrivebeskyttet statusside for Dinero (Visma) regnskabsintegrationen: den forbundne Dinero-konto, kontonumrene Fenster bogfører på, samt genopfrisk-/afbryd-handlinger.",
    noSave: true,
    sections: [
      {
        h: "Dinero integration",
        fields: [
          { t: "note", val: "Fenster er forbundet til følgende Dinero-konto:" },
          {
            t: "subtable",
            cols: ["Dinero indstilling", "Dinero værdi"],
            rows: [
              ["Dinero firma ID", "639460"],
              ["Firmanavn", "KRLTFL ApS"],
              ["Brugernavn", "Kristian Zanchetta Klercke"],
              ["Bruger-email", "k@klerckegroup.dk"],
              ["Momsfritaget", "Nej"],
            ],
          },
        ],
      },
      {
        h: "Dinero kontoplan",
        fields: [
          { t: "note", val: "Fenster anvender følgende kontonumre fra din Dinero kontoplan:" },
          {
            t: "subtable",
            cols: ["Dinero kontonr.", "Dinero kontonavn", "Fenster brug"],
            rows: [
              ["1000", "Salg af varer/ydelser m/moms", "Bogføring af afsendte fakturaer"],
              ["55040", "Kontanter (kasse)", "Bogføring af kontante betalinger"],
              ["Ikke konfigureret", "-", "Bogføring af betalinger modtaget via MobilePay Get Paid (ikke det samme som MobilePay Integreret betaling)"],
            ],
          },
          { t: "note", val: "Kontakt support@fenster.dk, hvis du ønsker, at Fenster skal anvende andre kontonumre i din Dinero kontoplan." },
          { t: "buttons", btns: [["Genopfrisk forbindelsen til Dinero", "outline-primary"], ["Fjern forbindelsen til Dinero", "danger"]] },
        ],
      },
    ],
  },
};
