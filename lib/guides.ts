// User guides for the in-app Vejledninger page (/guides). Content authored as
// Danish how-tos grounded in the actual UI. Plain data — rendered by
// components/GuideContent + app/guides/page.tsx (no markdown dependency).
export type GuideStep = { title: string; body: string };
export type Guide = { title: string; slug: string; audience: string; intro: string; steps: GuideStep[]; tips: string[] };

export const GUIDES: Guide[] = [
  {
    "title": "Sådan får du ordrer ind i planlægningen (kalenderen)",
    "slug": "planlaegning",
    "audience": "Kontor- og driftspersonale (ikke udviklere)",
    "intro": "Kalenderen er hjertet i Karltoffel: Alle ordrer med en leveringsuge bliver automatisk planlagt på medarbejdere og tidspunkter, når du åbner ugen. Denne guide viser, hvor ordrerne kommer fra, hvordan den automatiske planlægning virker, og hvordan du selv flytter, låser eller sletter ordrer direkte i kalenderen.",
    "steps": [
      {
        "title": "Forstå, hvor ordrerne kommer fra",
        "body": "Alt, der vises i kalenderen, er en ordre. En ordre kan komme fra fire kilder:\n1. Manuel ordre — du opretter den selv under Kartotek → Ordrer. I formularen vælger du under \"Planlægning i kalender\" feltet \"Uge\" (f.eks. \"Uge 29, 2026\") og klikker \"Opret ordre\". Som hjælpeteksten siger: \"Ordren planlægges automatisk i den valgte uge.\"\n2. Abonnement — systemet opretter ordrerne automatisk ud fra abonnementets interval (vises i kalenderen som \"Abo. #…\").\n3. Fastprisaftale — ordrer fra en fastprisaftale (vises som \"Fastprisaftale\").\n4. Online ordre — bestilt af kunden online (vises som \"Online ordre\").\nDet vigtige er: Hver ordre har en leveringsuge — ikke et fast klokkeslæt. Dag og tidspunkt bestemmes af den automatiske planlægning."
      },
      {
        "title": "Åbn kalenderen — planlægningen sker automatisk",
        "body": "1. Klik på \"Kalender\" i topmenuen.\n2. Ugen vises med det samme færdigplanlagt: Systemet tager alle ugens ordrer og fordeler dem på medarbejdere og tidspunkter inden for arbejdstiden, så køretiden bliver kortest mulig (ruten planlægges fra nærmeste adresse til nærmeste adresse).\nDu behøver altså ikke selv placere ordrerne på dage — det sker automatisk, hver gang ugen åbnes. I sidepanelet under \"Planlægning\" kan du se, hvornår natplanlægningen sidst kørte (f.eks. \"Planlagt i dag kl. 03:01\").\nI sidepanelet kan du desuden slå medarbejdere til/fra under \"Medarbejdere\" og se \"Planlagt omsætning\" og \"Planlagt kørsel\" for ugen."
      },
      {
        "title": "Naviger mellem uger",
        "body": "Øverst i kalenderen:\n1. Klik på \"‹\" for at gå en uge tilbage, eller \"›\" for en uge frem.\n2. Klik på \"Idag\" for at hoppe tilbage til den aktuelle uge.\n3. Skift visning med knapperne \"Dag\", \"5 dg\" og \"7 dg\".\n4. Klik på forstørrelsesglasset (\"Søg i kalenderen\") for at søge — feltet hedder \"Søg kunde, postnr, ordrenr…\". Ordrer, der ikke matcher, tones ned.\nUgenummeret vises som et mærke, f.eks. \"UGE 27\"."
      },
      {
        "title": "Genplanlæg ugen",
        "body": "Har du tilføjet, flyttet eller slettet ordrer og vil se en frisk plan:\n1. Gå til \"Kalender\".\n2. Klik på knappen \"Genplanlæg uge\" i sidepanelet under \"Planlægning\" (knappen viser \"Planlægger…\", mens den arbejder).\nSystemet lægger så ugens plan igen ud fra alle ugens ordrer. Ordrer, der er fastgjort til en ugedag, bliver på deres dag."
      },
      {
        "title": "Åbn ordremenuen ved at klikke på en ordre",
        "body": "Klik på en ordre-boks i kalenderen — så åbner en menu med alle handlinger:\n• \"Rediger ordre …\" — åbner ordrens side.\n• \"Lås helt op\" og \"Lås op, fastgør til ugedag\" — styrer låsen (se næste trin).\n• \"Flyt til anden uge …\" — flytter ordren (se trin 6).\n• \"Mere …\" — åbner flere valg: \"Gå til kundedetaljer …\", \"Rediger abonnement …\" (kun ved abonnementsordrer), \"Send notifikation nu\", \"Afslut ordre …\" og \"Slet ordre …\".\nKlik et vilkårligt sted uden for menuen for at lukke den."
      },
      {
        "title": "Flyt en ordre til en anden uge",
        "body": "1. Klik på ordren i kalenderen.\n2. Klik på \"Flyt til anden uge …\".\n3. Vælg et af punkterne: \"1 uge frem\", \"1 uge frem, lås helt op\", \"2 uger frem\", \"1 uge tilbage\" eller \"2 uger tilbage\".\nOrdren får en ny leveringsuge og bliver automatisk planlagt ind i den nye uge. Vælger du \"1 uge frem, lås helt op\", frigives en eventuel dags-lås samtidig, så planlæggeren frit kan vælge den bedste dag i den nye uge."
      },
      {
        "title": "Lås en ordre til en ugedag — eller lås den helt op",
        "body": "1. Klik på ordren i kalenderen.\n2. Vælg \"Lås op, fastgør til ugedag\" for at fastgøre ordren til den ugedag, den ligger på nu. Planlæggeren flytter den så aldrig til en anden dag — heller ikke ved \"Genplanlæg uge\".\n3. Vælg \"Lås helt op\" for at fjerne låsen igen, så planlæggeren frit må placere ordren på en hvilken som helst dag i ugen.\nBrug låsen, når du har aftalt en bestemt dag med kunden."
      },
      {
        "title": "Slet en ordre",
        "body": "1. Klik på ordren i kalenderen.\n2. Klik på \"Mere …\" og derefter \"Slet ordre …\".\n3. I dialogen \"Slet ordre\" bekræfter du med knappen \"Slet ordre\" (eller fortryder med \"Luk\").\nBemærk advarslen i dialogen: \"Denne handling kan ikke fortrydes.\" Ordren forsvinder fra kalenderen med det samme."
      },
      {
        "title": "Abonnementsordrer oprettes automatisk",
        "body": "Ordrer fra abonnementer skal du normalt ikke oprette selv:\n1. Systemet opretter dem automatisk hver nat ud fra abonnementets interval og startuge — cirka et halvt år frem. De dukker selv op i kalenderen i deres leveringsuge.\n2. Vil du ikke vente på natkørslen: Gå til Kartotek → Abonnementer og klik på knappen \"Generér kommende ordrer\". Så oprettes alle kommende abonnementsordrer med det samme.\n3. Når du opretter eller redigerer et abonnement, oprettes/opdateres dets kommende ordrer også automatisk (allerede afsluttede eller fastgjorte ordrer røres ikke).\nFerieuger (lukkeuger) springes automatisk over, og der oprettes aldrig dubletter i samme uge."
      }
    ],
    "tips": [
      "Kalenderen planlægger automatisk hver gang — du bestemmer kun ugen på en ordre, systemet finder dag, tidspunkt og medarbejder.",
      "Har du aftalt en fast dag med kunden, så brug \"Lås op, fastgør til ugedag\" — ellers kan \"Genplanlæg uge\" flytte ordren til en anden dag.",
      "Farverne i kalenderen forklares i sidepanelet under \"Forklaringer\" (status) og \"Ordretype\".",
      "Mangler en abonnementsordre i kalenderen, så tjek at abonnementet er aktivt og har en startuge, og klik derefter \"Generér kommende ordrer\" under Kartotek → Abonnementer.",
      "Klik på en dags overskrift i kalenderen for at åbne dagens program (Dagsprogram) med præcise tider og rækkefølge."
    ]
  },
  {
    "title": "Sådan opretter du en kunde",
    "slug": "opret-kunde",
    "audience": "Kontor- og driftspersonale hos vinduespudserfirmaet (ingen teknisk viden nødvendig).",
    "intro": "Denne guide viser, hvordan du opretter en ny kunde (kontakt) i Karltoffel CRM, hvad felterne betyder, og hvad afkrydsningen \"Virksomhed\" gør. Du finder også ud af, hvor du redigerer og sletter en kunde bagefter.",
    "steps": [
      {
        "title": "Gå til kundeoversigten",
        "body": "1. Log ind i portalen (brugernavn: kristianklercke).\n2. Klik på Kartotek i topmenuen, og vælg Kunder.\n3. Du lander nu på siden \"Oversigt over kunder\"."
      },
      {
        "title": "Åbn oprettelsesformularen",
        "body": "1. Klik på knappen Opret ny kontakt øverst til venstre over tabellen.\n2. Formularen \"Opret ny kontakt\" åbner.\n\nTip: Du kan også åbne den samme formular fra en kundes side \"Kundedetaljer\" via knappen Opret ny kontakt."
      },
      {
        "title": "Vælg kontakttype: privat eller virksomhed",
        "body": "Under Kontakttype finder du afkrydsningsfeltet Virksomhed:\n\n- Uden flueben (privatkunde): Du udfylder blot Navn, som bliver kundens navn i systemet.\n- Med flueben (virksomhed): Der kommer tre ekstra felter frem: Virksomhedsnavn, CVR-nummer og EAN-nummer. Virksomhedsnavnet bliver kundens navn i kundeoversigten, og feltet Navn bruges i stedet til kontaktpersonen hos virksomheden (att.).\n\nOm EAN: \"Faktura sendes elektronisk via EAN, såfremt et EAN-nummer er angivet.\" Udfyld derfor kun EAN-nummer, hvis kunden (typisk offentlige institutioner) skal have elektronisk faktura."
      },
      {
        "title": "Udfyld kontaktoplysningerne",
        "body": "Udfyld felterne:\n\n1. Navn – privatkundens navn, eller kontaktpersonen hvis Virksomhed er afkrydset. Feltet er obligatorisk; ellers vises fejlen \"Angiv et navn.\"\n2. E-mail – kundens e-mailadresse.\n3. Telefon – kundens telefonnummer.\n4. Adresse – skrives i ét felt i formatet \"Vejnavn husnr., postnr. by\" (fx \"Kartoffelvej 12, 8000 Aarhus C\"). Husk kommaet mellem vejnavn/husnummer og postnummer/by.\n5. Adressebemærkning – valgfrit internt notat, der relaterer sig til adressen (kontakten), fx \"nøgle under måtten\". Kunden ser det ikke."
      },
      {
        "title": "Gem kontakten",
        "body": "1. Klik på Opret kontakt nederst i formularen (knappen viser kort \"Gemmer…\").\n2. Du sendes automatisk videre til kundens side \"Kundedetaljer\", hvor du kan se kontaktinfoen og oprette abonnementer, fastprisaftaler m.m.\n\nVil du annullere uden at gemme, skal du klikke på Luk."
      },
      {
        "title": "Rediger en kunde",
        "body": "1. Gå til Kartotek → Kunder, og klik på kundens nummer eller vælg Se kundedetaljer i rækkens menu (pilen yderst til venstre).\n2. På siden \"Kundedetaljer\" klikker du på Rediger kontaktinfo i boksen \"Kundens kontaktinfo\".\n3. Ret felterne i formularen \"Rediger kontaktinfo\", og klik Gem ændringer.\n\nKundens fakturaindstillinger redigeres separat via knappen Rediger indstillinger i boksen \"Kundens indstillinger\"."
      },
      {
        "title": "Slet en kunde",
        "body": "1. Gå til Kartotek → Kunder.\n2. Klik på menupilen yderst til venstre i kundens række, og vælg Slet kunde…\n3. Bekræft i dialogen ved at klikke Slet kunde.\n\nAdvarsel: Alle kundens abonnementer, fastprisaftaler og ordrer slettes også, og handlingen kan ikke fortrydes."
      }
    ],
    "tips": [
      "En nyoprettet kontakt vises IKKE i \"Oversigt over kunder\", før den har mindst én ordre eller ét abonnement – oversigten viser kun kontakter med ordrer/abonnementer. Find i stedet kontakten via linket, du lander på lige efter oprettelsen.",
      "Skriv altid adressen med komma: \"Vejnavn husnr., postnr. by\". Systemet deler adressen ved det første komma, så uden komma registreres by ikke korrekt.",
      "Sæt kun flueben i Virksomhed, når det faktisk er en virksomhed – så udskrives virksomhedsnavnet som kundens navn, og personen i Navn-feltet gemmes som kontaktperson (att.).",
      "Kun feltet Navn er obligatorisk – men udfyld altid telefon og e-mail, så I kan sende ordrebekræftelser og fakturaer.",
      "Brug søgefeltet på kundeoversigten til at finde eksisterende kunder, før du opretter en ny – du kan søge på kundenr., navn, e-mail, telefon, vejnavn, husnr. og postnr."
    ]
  },
  {
    "title": "Sådan opretter du en manuel ordre",
    "slug": "opret-ordre",
    "audience": "Kontor- og driftspersonale, der tager imod bestillinger og planlægger ordrer.",
    "intro": "Denne guide viser, hvordan du opretter en ordre manuelt i Karltoffel – f.eks. når en kunde ringer og bestiller en enkeltstående opgave. Du vælger kunden, tilføjer én eller flere opgavelinjer og vælger den uge, ordren skal leveres i. Når ordren er oprettet, planlægges den automatisk i kalenderen for den valgte uge.",
    "steps": [
      {
        "title": "Åbn siden \"Opret ny ordre\"",
        "body": "Den nemmeste vej er via kunden: 1. Gå til Kartotek → Kunder i topmenuen. 2. Klik på kunden for at åbne kundekortet. 3. Klik på den blå knap \"Opret ny ordre på kunden\" (den står ud for overskriften \"Kundens ordrer\"). Så er kunden allerede udfyldt på ordren.\n\nAlternativt: Gå til Kartotek → Ordrer, klik på menu-ikonet yderst til venstre på en af kundens eksisterende ordrer, og vælg \"Opret ny ordre\". Siden \"Opret ny ordre\" åbner. Fortryder du, kan du altid klikke \"Gå tilbage\" øverst til højre."
      },
      {
        "title": "Vælg kunden",
        "body": "I boksen \"Kunde\" finder du feltet \"Fakturerings- og leveringsadresse\". 1. Klik på rullelisten (der står \"Klik for at fremsøge eller oprette ny kontakt\"). 2. Vælg kunden på listen – hver linje viser navn og adresse. Når kunden er valgt, vises navn og adresse nedenunder, så du kan tjekke, at det er den rigtige.\n\nFindes kunden ikke endnu, skal du klikke på knappen \"Opret ny kontakt\" og oprette kunden først."
      },
      {
        "title": "Tilføj opgavelinjer",
        "body": "I boksen \"Opgaver på ordren\" udfylder du én linje pr. opgave: 1. Skriv opgaven i feltet \"Opgavebeskrivelse\" (feltet viser \"Fremsøg eller opret ny opgave\") – f.eks. \"Pudsning af vinduer, ud- og indvendigt\". 2. Vælg \"Kategori\" i rullelisten, f.eks. Vinduespudsning, Tagrenderens eller Algebehandling – kategorien bestemmer det farvede bogstav-mærke, opgaven vises med i kalenderen. 3. Skriv prisen i \"Pris (inkl. moms)\" – i hele kroner, inklusive moms. 4. Skriv den forventede tid i \"Varighed (min.)\" – i minutter.\n\nNår både pris og varighed er udfyldt, viser systemet en lille hjælpe­tekst \"Timepris ... kr/t\" under beskrivelsen, så du kan tjekke, at prisen er fornuftig. Skal ordren indeholde flere opgaver, klikker du på \"Tilføj opgave\" og udfylder en linje mere. En linje fjernes med skraldespands-ikonet yderst til højre (Fjern opgave). Nederst i tabellen viser rækken \"Sum\" den samlede pris og varighed."
      },
      {
        "title": "Vælg leveringsuge",
        "body": "I boksen \"Planlægning i kalender\": 1. Klik på rullelisten \"Uge\". 2. Vælg den uge, ordren skal leveres i – listen viser de kommende 12 uger, f.eks. \"Uge 28, 2026 (6/7 - 12/7)\". Som teksten under feltet siger: \"Ordren planlægges automatisk i den valgte uge.\" Du vælger altså kun uge – ikke dag og klokkeslæt; det klarer planlægningen selv."
      },
      {
        "title": "Opret ordren",
        "body": "1. Klik på den blå knap \"Opret ordre\" nederst på siden (knappen viser \"Opretter…\", mens der gemmes). 2. Du sendes derefter direkte til den nye ordres side.\n\nHar du glemt noget, får du en fejlbesked over knappen: \"Vælg en kunde.\" hvis der ikke er valgt kunde, eller \"Tilføj mindst én opgave.\" hvis ingen opgavelinjer er udfyldt. Vil du annullere uden at oprette, klikker du på \"Luk\"."
      },
      {
        "title": "Ordren ligger nu i planlægningen",
        "body": "Den nye ordre får status \"Afventer levering\" og placeres automatisk i kalenderen i den valgte uge. Du kan se den under Kalender og i Dagsprogram, og den fremgår også af listen under Kartotek → Ordrer med kilden \"manual\". Vil du hoppe direkte til ordren i kalenderen, kan du bruge menupunktet \"Vis ordre i kalender\" i ordrelisten."
      }
    ],
    "tips": [
      "Opgavelinjer uden tekst i \"Opgavebeskrivelse\" gemmes ikke – husk altid en beskrivelse på hver linje.",
      "Prisen skrives altid inkl. moms, og varigheden i minutter – brug hjælpe­teksten \"Timepris ... kr/t\" til et hurtigt tjek af, om pris og tid hænger sammen.",
      "Ugelisten viser kun de kommende 12 uger. Skal ordren længere ud i fremtiden, kan du oprette den i den sidste uge på listen og bagefter flytte den via kalenderens menupunkt \"Flyt til anden uge\".",
      "Er det en fast, tilbagevendende opgave, skal du oprette et abonnement (Kartotek → Abonnementer) i stedet for en manuel ordre – en manuel ordre er en engangsopgave.",
      "Når arbejdet er udført, afslutter du ordren via menupunktet \"Afslut ordre…\" på ordrelisten."
    ]
  },
  {
    "title": "Sådan opretter du et abonnement (fast tilbagevendende aftale)",
    "slug": "opret-abonnement",
    "audience": "Kontor- og driftspersonale, der planlægger tilbagevendende vinduespudsning for faste kunder.",
    "intro": "Et abonnement er en fast, tilbagevendende aftale med en kunde – fx vinduespudsning hver 2. uge. Når abonnementet er oprettet, genererer systemet automatisk de kommende ordrer cirka et halvt år frem, så de dukker op i Kalender, Dagsprogram og under Ordrer. Denne guide viser dig, hvordan du opretter abonnementet trin for trin.",
    "steps": [
      {
        "title": "Gå til abonnementsoversigten",
        "body": "1. Klik på Kartotek i topmenuen.\n2. Vælg Abonnementer.\n3. Du står nu på siden \"Oversigt over abonnementer\".\n4. Klik på knappen \"Opret nyt abonnement\". Siden \"Opret abonnement\" åbner."
      },
      {
        "title": "Vælg kunden",
        "body": "1. I boksen \"Kunde\" finder du feltet \"Fakturerings- og leveringsadresse\".\n2. Klik på rullelisten \"Klik for at fremsøge eller oprette ny kontakt\" og vælg kunden. Kundens navn og adresse vises under feltet, når kunden er valgt.\n3. Findes kunden ikke endnu, så klik på \"Opret ny kontakt\" og opret kunden først."
      },
      {
        "title": "Vælg basis-interval og startuge",
        "body": "1. I boksen \"Opgaver på abonnementet\" vælger du \"Basis-interval\" – fx \"Hver 2. uge\". Basis-intervallet er abonnementets grundrytme, dvs. hvor ofte der som udgangspunkt køres ud til kunden. Du kan vælge alt fra \"Hver uge\" til \"Hver 52. uge\".\n2. Udfyld feltet \"Startuge\" med den uge, hvor abonnementet skal begynde – skriv fx \"Uge 29\".\n3. VIGTIGT: Uden en startuge kan systemet ikke generere de fremtidige ordrer, så feltet skal altid udfyldes."
      },
      {
        "title": "Tilføj opgavelinjer",
        "body": "1. Udfyld den første linje i opgavetabellen: skriv opgaven i \"Opgavebeskrivelse\" (fx \"Vinduespudsning udvendig\"), vælg \"Kategori\", og udfyld \"Pris (inkl. moms)\" og \"Varighed (min.)\".\n2. Klik på \"Tilføj opgave\" for at tilføje flere linjer – fx en ekstra linje til indvendig pudsning eller tagrenderens.\n3. Vil du fjerne en linje, så klik på skraldespands-ikonet yderst til højre på linjen.\n4. Nederst i tabellen viser \"Sum\"-linjen den samlede pris og varighed."
      },
      {
        "title": "Sæt interval og startuge pr. opgavelinje",
        "body": "Hver opgavelinje har sine egne to kolonner:\n1. \"Interval\": Hvor ofte opgaven skal med, målt i besøg. \"Hver gang\" betyder ved hvert besøg (dvs. hver 2. uge, hvis basis-intervallet er \"Hver 2. uge\"). \"Hver 2. gang\" betyder hvert andet besøg, osv. op til \"Hver 12. gang\". Vælg \"På anmodning\", hvis opgaven kun skal udføres, når kunden beder om det – den bliver så ALDRIG planlagt automatisk.\n2. \"Næste gang\": Skriv en uge (fx \"Uge 29\"), hvis opgaven skal starte i en anden uge end abonnementets startuge – fx tagrenderens, der først begynder senere. Lader du feltet stå tomt, følger opgaven abonnementets startuge."
      },
      {
        "title": "Vælg eventuelt en fast medarbejder",
        "body": "1. I boksen \"Særlige betingelser for planlægning\" finder du feltet \"Medarbejder\".\n2. Lad den stå på \"Vælges automatisk\", hvis det er ligegyldigt, hvem der kører opgaven – eller vælg en bestemt medarbejder, hvis kunden altid skal have den samme person.\n3. Den valgte medarbejder sættes automatisk på alle de ordrer, systemet opretter fra abonnementet."
      },
      {
        "title": "Gem abonnementet",
        "body": "1. Klik på den blå knap \"Opret abonnement\" nederst på siden.\n2. Systemet gemmer abonnementet, giver det et Abo. nr. og genererer med det samme de kommende ordrer cirka 26 uger frem. Du sendes derefter videre til abonnementets side.\n3. Vil du fortryde uden at gemme, så klik på \"Luk\" eller \"Gå tilbage\".\n4. Mangler der noget, får du en fejlbesked, fx \"Vælg en kunde.\", \"Vælg et basis-interval.\" eller \"Tilføj mindst én opgave.\""
      },
      {
        "title": "Automatisk ordre-generering og knappen \"Generér kommende ordrer\"",
        "body": "Systemet opretter selv de fremtidige ordrer ud fra basis-interval, startuge og opgavelinjernes intervaller – både når du gemmer abonnementet, og løbende hver nat. Ordrerne kan ses under Kartotek → Ordrer samt i Kalender og Dagsprogram.\n\nDu kan også sætte genereringen i gang manuelt:\n1. Gå til Kartotek → Abonnementer.\n2. Klik på knappen \"Generér kommende ordrer\" øverst i oversigten. Den opretter kommende ordrer for ALLE aktive abonnementer og sender dig videre til ordreoversigten.\n\nDet er helt ufarligt at klikke flere gange: systemet springer uger over, hvor der allerede findes en ordre, og springer også ferielukkede uger over."
      }
    ],
    "tips": [
      "Husk altid at udfylde \"Startuge\" (fx \"Uge 29\") – uden den bliver der ikke oprettet nogen fremtidige ordrer.",
      "Opgaver med intervallet \"På anmodning\" planlægges aldrig automatisk – de skal oprettes som ordre manuelt, når kunden ringer.",
      "Kolonnen \"Fremtidige ordrer\" i abonnementsoversigten viser, hvornår næste besøg er planlagt.",
      "Retter du senere i abonnementet, opdateres kun de fremtidige, uafsluttede ordrer fra næste uge og frem – historik, låste ordrer og indeværende uges plan røres ikke.",
      "Skal et abonnement ophøre, så brug menuen på linjen i oversigten og vælg \"Stop abonnement…\" – så oprettes der ikke flere ordrer.",
      "Du kan oprette abonnementet direkte fra kundens side, så kunden er valgt på forhånd."
    ]
  },
  {
    "title": "Fastprisaftaler og afslutning af ordrer",
    "slug": "fastpris-og-afslut",
    "audience": "Kontor- og driftspersonale hos vinduespudserfirmaet — ingen teknisk viden kræves.",
    "intro": "En fastprisaftale er knyttet til en leveringsadresse og bruges til kunder, der ikke har et abonnement — f.eks. når man opretter en manuel ordre i kalenderen, eller når kunden bestiller online. En fastprisaftale har ingen interval; den består kun af en eller flere opgavelinjer med pris og varighed. Denne guide viser først, hvordan du opretter en fastprisaftale, og derefter hvordan du afslutter en ordre, når arbejdet er udført (eller ikke blev udført).",
    "steps": [
      {
        "title": "Del 1 – Åbn oversigten over fastprisaftaler",
        "body": "1. Log ind (kristianklercke / karltoffel).\n2. Gå til topmenuen og klik på Kartotek.\n3. Vælg Fastprisaftaler. Du lander på siden \"Oversigt over fastprisaftaler\", som viser Aftale nr., Leveringsadresse, Opgaver og Pris for hver aftale. Du kan søge i feltet med teksten \"kundenavn, kundenr, email, tlf, vejnavn, husnr, postnr\"."
      },
      {
        "title": "Opret en ny fastprisaftale",
        "body": "1. Klik på knappen \"Opret ny fastprisaftale\" øverst i oversigten.\n2. Du kommer til siden \"Opret fastprisaftale\"."
      },
      {
        "title": "Vælg kunden (leveringsadressen)",
        "body": "1. I sektionen \"Leveringsadresse\" åbner du rullelisten \"Klik for at fremsøge eller oprette ny kontakt\" og vælger kunden. Kundens navn og adresse vises under feltet, når du har valgt.\n2. Findes kunden ikke, klik på knappen \"Opret ny kontakt\" og opret kunden først.\nBemærk: Du SKAL vælge en kunde — ellers får du fejlen \"Vælg en kunde.\" når du prøver at gemme."
      },
      {
        "title": "Tilføj opgavelinjer (pris og varighed)",
        "body": "I sektionen \"Pris og varighed\" udfylder du én linje pr. opgave:\n1. Opgavebeskrivelse — skriv opgaven i feltet \"Fremsøg eller opret ny opgave\" (f.eks. \"Vinduespudsning ud- og indvendig\").\n2. Kategori — vælg kategori i rullelisten (standard er Vinduespudsning).\n3. Pris (inkl. moms) — skriv prisen i kroner.\n4. Varighed (min.) — skriv den forventede tid i minutter. Systemet viser automatisk \"Timepris ... kr/t\" under beskrivelsen.\n5. Klik på \"Tilføj opgave\" for at tilføje flere linjer. Fjern en linje med skraldespands-knappen (\"Fjern opgave\").\nNederst viser rækken \"Sum\" den samlede pris og varighed. Bemærk: Der er INGEN interval-kolonne på en fastprisaftale — den gentages ikke automatisk. Mindst én opgavelinje skal udfyldes, ellers får du fejlen \"Tilføj mindst én opgave.\""
      },
      {
        "title": "Gem aftalen",
        "body": "1. Klik på den blå knap \"Opret fastprisaftale\" nederst (knappen viser \"Gemmer…\" mens den arbejder).\n2. Aftalen får automatisk et Aftale nr., og du sendes videre til siden \"Rediger fastprisaftale #nr\".\n3. Vil du annullere i stedet, klik \"Luk\" eller \"Gå tilbage\".\nSenere kan du rette aftalen: Åbn Kartotek → Fastprisaftaler, klik på rækkens menu og vælg \"Rediger fastprisaftale\". Gem ændringer med \"Opdater fastprisaftale\", eller slet aftalen med \"Slet fastprisaftale\" (kan ikke fortrydes)."
      },
      {
        "title": "Del 2 – Find ordren, der skal afsluttes",
        "body": "Du kan komme til afslutningssiden fire steder fra:\n1. Kartotek → Ordrer: Klik på rækkens menu ud for ordren og vælg \"Afslut ordre…\".\n2. Åbn selve ordren og klik på den blå knap \"Afslut ordre\".\n3. Dagsprogram: Klik på \"Afslut ordre\" på dagens stop.\n4. Kalender: Åbn menuen på ordren og vælg \"Afslut ordre …\".\nAlle veje fører til siden \"Afslut ordre\", som øverst viser \"Kundeinfo\" og \"Pris\" (pris uden kørsel, kørselsgebyr — alle beløb inkl. moms)."
      },
      {
        "title": "Vælg leveringsstatus",
        "body": "I sektionen \"Leveringsstatus\" vælger du én af de fire muligheder:\n1. \"Udført\" — arbejdet er lavet som planlagt.\n2. \"Ikke udført, spring over\" — besøget droppes denne gang (ordren markeres som \"Sprunget over\").\n3. \"Ikke udført, skal genplanlægges\" — besøget skal have en ny dato (ordren markeres som \"Skal genplanlægges\").\n4. \"Anden status\".\nDu SKAL vælge en status — ellers får du fejlen \"Vælg en leveringsstatus.\""
      },
      {
        "title": "Vælg betaling og fakturering",
        "body": "I sektionen \"Betaling og fakturering\" (\"Vælg om der skal faktureres via Dinero\") vælger du én af mulighederne:\n1. \"Send faktura - ubetalt\"\n2. \"Send faktura - betalt kontant\"\n3. \"Send ikke faktura fra Fenster\"\n4. \"Opret fakturakladde\"\n5. \"Registrer på et senere tidspunkt\"\nTip: Valget kan være forudindstillet pr. kunde under kundens indstillinger."
      },
      {
        "title": "Skriv kommentar og adressebemærkning (valgfrit)",
        "body": "1. \"Ordrekommentar\": Tilføj en valgfri, intern kommentar vedr. denne ordre, f.eks. en kommentar om leveringen. Den gemmes på ordren.\n2. \"Adressebemærkning\": Opdater et valgfrit, internt notat, der relaterer sig til leveringsadressen, og som er godt at huske til næste besøg hos kunden (f.eks. \"Nøgle under måtten\" eller \"Hunden skal holdes inde\")."
      },
      {
        "title": "Afslut ordren",
        "body": "1. Klik på den blå knap \"Afslut ordre\" nederst (den viser \"Afslutter…\" mens den gemmer).\n2. Du sendes tilbage til der, hvor du kom fra, og ordrens status opdateres (f.eks. til \"Udført\"). Statussen kan ses i kolonnen \"Ordrestatus\" på siden \"Oversigt over ordrer\".\n3. Fortryder du, kan du klikke \"Tilbage\" i stedet — så gemmes intet."
      }
    ],
    "tips": [
      "En fastprisaftale gentages ikke automatisk — skal kunden have fast, tilbagevendende service, skal du i stedet oprette et abonnement (Kartotek → Abonnementer).",
      "Du kan oprette en fastprisaftale direkte fra en kunde, så kunden er valgt på forhånd.",
      "Ordrer med overskredet leveringsdato markeres med gul dato i \"Oversigt over ordrer\" med teksten \"Ordren er ikke afsluttet\" — brug listen til at fange ordrer, der mangler at blive afsluttet.",
      "Vælger du \"Ikke udført, skal genplanlægges\", skal du huske selv at give ordren en ny dato i kalenderen bagefter.",
      "Adressebemærkningen følger leveringsadressen og vises igen ved næste besøg — brug den til praktiske detaljer som nøgler, koder og adgangsforhold."
    ]
  },
  {
    "title": "Sådan sender du et tilbud til en kunde",
    "slug": "send-tilbud",
    "audience": "Kontor- og driftspersonale",
    "intro": "Med den nye tilbudsfunktion kan du sende et tilbud på e-mail direkte fra en ordre eller fra en kunde. Emne og besked udfyldes automatisk ud fra tilbuds-skabelonen og kundens/ordrens oplysninger (navn, leveringsadresse, opgaver og priser) – du skal bare tjekke teksten og klikke send.",
    "steps": [
      {
        "title": "Åbn tilbuddet fra en ordre (den typiske vej)",
        "body": "1. Gå til Kartotek → Ordrer og åbn den ordre, tilbuddet skal baseres på.\n2. Klik på knappen \"Send tilbud\" nederst på ordresiden (ved siden af \"Afslut ordre\").\n3. Du kan også åbne den fra kundens side: I tabellen \"Kundens ordrer\" klikker du på menuen ud for ordren og vælger \"Send tilbud på ordren…\".\nOrdrens opgaver og priser bliver automatisk til opgavelisten og totalen i tilbuddet."
      },
      {
        "title": "Eller åbn tilbuddet fra en kunde",
        "body": "1. Gå til Kartotek → Kunder og åbn kunden.\n2. Klik på knappen \"Send tilbud\" i boksen \"Kundens kontaktinfo\".\nHar kunden en ordre i forvejen, udfyldes tilbuddet ud fra kundens seneste ordre. Har kunden ingen ordrer, får du et tomt tilbud uden opgaveliste, hvor du selv skriver detaljerne i beskeden."
      },
      {
        "title": "Tjek modtager, emne og besked",
        "body": "Du lander på siden \"Send tilbud\". Teksten er udfyldt automatisk ud fra skabelonen – du kan rette den til, før du sender:\n1. \"Modtager (e-mail)\": Kundens e-mailadresse er udfyldt på forhånd. Står der \"Kunden har ingen e-mailadresse — indtast en modtager\", skal du selv skrive en adresse.\n2. \"Emne\": Forudfyldt fra skabelonen, f.eks. \"Tilbud på vinduespudsning – [adresse]\". Ret det, hvis du vil.\n3. \"Besked\": Selve tilbudsteksten med kundens navn, adresse, opgaveliste, samlet pris og gyldighedsdato. Du kan tilrette teksten frit, før du sender.\n4. Under \"Opgaver på tilbuddet\" ser du opgaverne med priser og \"Samlet pris (inkl. moms)\" – tjek at de stemmer."
      },
      {
        "title": "Send tilbuddet",
        "body": "1. Klik på knappen \"Send tilbud\" nederst på siden (knappen viser \"Sender…\", mens den arbejder).\n2. Ved succes ser du en grøn bekræftelse, f.eks. \"Tilbud sendt til kunde@eksempel.dk.\"\n3. Vil du ikke sende alligevel, klikker du \"Annullér\" eller \"Gå tilbage\" – så sker der intet.\nFår du en fejlbesked som \"Angiv en gyldig e-mailadresse.\" eller \"Angiv et emne.\", skal du rette feltet og klikke \"Send tilbud\" igen."
      },
      {
        "title": "Tilpas tilbuds-skabelonen (valgfrit)",
        "body": "Vil du ændre standardteksten for alle fremtidige tilbud:\n1. Gå til Indstillinger → \"E-mail og SMS skabeloner\" → \"Tilbudsmail\".\n2. Ret emne og besked. Du kan bruge flettefelter som {{kunde_fornavn}}, {{leverings_adresse}}, {{opgave_liste}}, {{tilbud_total}} og {{tilbud_gyldig_til}} – de udfyldes automatisk med kundens og ordrens data, når du sender et tilbud."
      }
    ],
    "tips": [
      "Afsendelse kræver, at en e-mail-udbyder er sat op. Er der ingen udbyder endnu, sendes e-mailen ikke rigtigt – du får i stedet beskeden \"Tilbuddet er klar (simuleret – ingen e-mail-udbyder er konfigureret endnu).\"",
      "Tilbuddet sendes præcis med den tekst, du ser i \"Besked\"-feltet – ret f.eks. priser eller opgaver i teksten, hvis de ikke skal med.",
      "Gyldighedsdatoen ({{tilbud_gyldig_til}}) sættes automatisk til 30 dage fra afsendelse.",
      "Skal tilbuddet følges op senere, findes der også en skabelon \"Opfølgning på tilbud\" under samme menu i Indstillinger."
    ]
  },
  {
    "title": "Emner (leads): modtag automatisk henvendelser fra hjemmesiden",
    "slug": "emner-leads",
    "audience": "Del A: kontor-/driftspersonale. Del B: den tekniske person bag hjemmesiden.",
    "intro": "Henvendelser fra hjemmesidens kontaktformular lander nu automatisk i CRM'et som \"emner\". Del A viser, hvordan kontoret ser og behandler emnerne under Kartotek → Emner. Del B er en kort teknisk opskrift til den, der laver hjemmesiden, på hvordan serveren sender henvendelser ind.",
    "steps": [
      {
        "title": "Del A · Se indkomne henvendelser",
        "body": "1. Log ind og gå til **Kartotek → Emner**.\n2. Siden \"Emner\" viser de indkomne henvendelser fra hjemmesiden med kolonnerne **Dato, Navn, Kontakt, Besked, Kilde** og **Status**.\n3. Brug filterknapperne øverst til at afgrænse listen: **Alle**, **Ny**, **Kontaktet**, **Konverteret**, **Afvist**. Nye henvendelser står med status **Ny**.\n4. Er der ingen henvendelser, står der \"Ingen emner\"."
      },
      {
        "title": "Del A · Markér et emne som kontaktet",
        "body": "1. Find emnet i listen og klik på **⋮** (de tre prikker, \"Handlinger\") yderst til venstre i rækken.\n2. Vælg **Markér som kontaktet**.\n3. Status skifter til **Kontaktet**. Brug dette, når I har ringet eller skrevet til personen, men endnu ikke har lavet en aftale."
      },
      {
        "title": "Del A · Konvertér et emne til en kunde",
        "body": "1. Klik på **⋮** ud for emnet og vælg **Konvertér til kunde…**\n2. I vinduet \"Konvertér emne\" klikker du på **Konvertér** (eller **Luk** for at fortryde).\n3. Der oprettes en ny kunde med navn, e-mail, telefon og adresse fra emnet, og du sendes direkte til kundekortet.\n\nHvis afsenderen allerede findes i kundekartoteket, viser rækken mærket **eksisterende kunde**. Så hedder menupunktet i stedet **Åbn som kunde** (der oprettes ikke en dublet), og du kan også vælge **Vis kunde** for blot at åbne kundekortet uden at ændre emnets status."
      },
      {
        "title": "Del A · Afvis et emne",
        "body": "1. Klik på **⋮** ud for emnet og vælg **Afvis emne…** (rødt menupunkt).\n2. I vinduet \"Afvis emne\" klikker du på knappen **Afvis emne** for at bekræfte.\n3. Status skifter til **Afvist**. Emnet slettes ikke — det kan stadig findes under filteret **Afvist**, og det kan senere markeres som kontaktet eller konverteres, hvis kunden alligevel vender tilbage."
      },
      {
        "title": "Del B · Teknisk: send henvendelser fra hjemmesiden (webudvikler)",
        "body": "Hjemmesidens **server** (ikke browseren) sender hver formular-indsendelse som `POST` til CRM'ets endpoint `/api/leads` med den hemmelige nøgle i headeren `x-karltoffel-secret`. Nøglen er værdien af miljøvariablen `LEAD_WEBHOOK_SECRET` i CRM'et og skal være mindst 32 tegn — ellers svarer endpointet 503.\n\nJSON-body: `name` er påkrævet, og mindst én af `email` eller `phone` skal med. Valgfrit: `address`, `message`, `source`.\n\nEksempel:\n\n```\ncurl -X POST https://<jeres-crm-adresse>/api/leads \\\n  -H \"Content-Type: application/json\" \\\n  -H \"x-karltoffel-secret: <VÆRDIEN AF LEAD_WEBHOOK_SECRET>\" \\\n  -d '{\"name\":\"Hanne Jensen\",\"email\":\"hanne@example.dk\",\"phone\":\"12345678\",\"address\":\"Torvegade 12, 6700 Esbjerg\",\"message\":\"Vil gerne have et tilbud på vinduespudsning\",\"source\":\"website\"}'\n```\n\nSvar: `201` med `{\"id\":…,\"deduplicated\":false}` når emnet er oprettet. Sender samme person igen inden for 30 dage (samme e-mail/telefon, og emnet stadig er åbent), lægges beskeden sammen med det eksisterende emne, og svaret er `200` med `deduplicated:true`.\n\nFejlkoder: `400` ugyldig/manglende data, `401` forkert nøgle, `429` for mange forsøg (rate limit), `503` nøgle ikke konfigureret i CRM'et."
      },
      {
        "title": "Del B · Sikkerhed: nøglen må ALDRIG ligge i browseren",
        "body": "Kaldet skal altid ske fra hjemmesidens server (f.eks. et form-relay eller en serverfunktion). Læg aldrig `x-karltoffel-secret`-nøglen i JavaScript, der køres i browseren — så kan alle se den i udviklerværktøjerne og sende falske henvendelser. Endpointet sender bevidst ingen CORS-headere, så direkte kald fra en browser virker heller ikke. Opbevar nøglen som miljøvariabel/secret på hjemmesidens server."
      }
    ],
    "tips": [
      "Dubletbeskyttelse: skriver samme person to gange inden for 30 dage, oprettes der ikke et nyt emne — den nye besked tilføjes til det åbne emne, adskilt af en streg.",
      "Mærket \"eksisterende kunde\" ud for et navn betyder, at e-mail eller telefonnummer allerede matcher en kunde i kartoteket — brug \"Åbn som kunde\" i stedet for at oprette en dublet.",
      "Skriv adressen som \"Gade nr., Postnr. By\" i formularen — ved konvertering deles teksten ved første komma i gade og by.",
      "Et konverteret emne er låst: menuen viser kun \"Vis kunde\". Ret i stedet oplysningerne direkte på kundekortet.",
      "Kolonnen Kilde viser, hvor henvendelsen kom fra (feltet \"source\" — står som \"website\", hvis intet er angivet).",
      "Får webudvikleren svaret 503 \"Lead intake not configured\", er LEAD_WEBHOOK_SECRET ikke sat (eller er kortere end 32 tegn) i CRM'et."
    ]
  },
  {
    "title": "Funktioner og rapporter",
    "slug": "funktioner-og-rapporter",
    "audience": "Kontor- og driftspersonale, der bruger Karltoffel CRM i det daglige — ingen teknisk viden kræves.",
    "intro": "Under menuen \"Funktioner\" finder du fire værktøjer til den daglige drift: Gruppebeskeder, Ferieplanlægning, Abonnementsoptimering og Prisjustering. Under \"Rapportering\" finder du grafer, nøgletal og rapporter til download. Rabatkoder og Standardopgaver ligger under \"Indstillinger\". Log ind med brugernavn \"kristianklercke\" og adgangskode \"karltoffel\", før du går i gang.",
    "steps": [
      {
        "title": "Gruppebeskeder — send besked til en kundegruppe",
        "body": "Bruges til driftsbeskeder via e-mail og SMS til flere kunder på én gang (ikke til reklame).\n1. Gå til Funktioner → Gruppebeskeder.\n2. Under \"Send gruppebesked\": vælg en \"Kundegruppe\" (f.eks. \"Alle ordrer i en bestemt uge\" eller \"Alle abonnementskunder\"). Udfyld \"Dato\" eller \"Uge\", hvis gruppen kræver det, og vælg evt. \"Medarbejder\".\n3. Vælg kanal i \"Send besked som\" (f.eks. \"Både SMS og e-mail\").\n4. Udfyld \"E-mail emne\" og skriv teksten i feltet \"Besked\". \"Afsender på SMS\" må højst være 11 tegn.\n5. Klik \"Vis liste over modtagere\" for at se præcis, hvem der rammes, før du sender.\n6. Test evt. først med \"Send test e-mail\" eller \"Send test SMS\" under \"Send en test\".\n7. Klik \"Send besked til kundegruppen\" og bekræft i dialogen \"Bekræftelse\"."
      },
      {
        "title": "Ferieplanlægning — luk kalenderen i ferieuger",
        "body": "Når du opretter en ferie, lukkes kalenderen i de valgte uger, og alle abonnementsordrer skubbes frem i tid fra ferietidspunktet.\n1. Gå til Funktioner → Ferieplanlægning.\n2. Klik \"Opret ny ferie\" over tabellen \"Planlagte ferier\".\n3. Vælg \"Startuge\" og \"Slutuge\" i formularen \"Opret ferie\" (slutugen skal være samme uge eller senere).\n4. Klik \"Gem ferie\". Du får beskeden \"Ferie oprettet. Kalenderen er lukket i de valgte uger.\"\n5. Fortryd en ferie ved at klikke \"Slet\" ud for den i tabellen.\nVigtigt: Opret ferien mindst 1 uge før den starter. Kun abonnementsordrer skubbes — manuelle og online ordrer skal du selv håndtere, og kunderne orienteres ikke automatisk (brug evt. en gruppebesked)."
      },
      {
        "title": "Prisjustering — justér priser i procent",
        "body": "Guiden har tre trin: \"Indstillinger\", \"Tilpas opgaver\" og \"Bekræft og sæt i gang\".\n1. Gå til Funktioner → Prisjustering.\n2. Trin 1 \"Indstillinger\": skriv procenten i \"Procentuel justering (%)\" — f.eks. 5 for en stigning på 5 %, eller -3 for et fald. Vælg \"Afrunding\" (f.eks. \"Ingen afrunding\", \"5 kr.\" eller \"Slut på 9,95 kr.\") og \"Aftaletype\" (\"Juster både abonnementer og fastprisaftaler\", \"Juster kun abonnementer\" eller \"Juster kun fastprisaftaler\").\n3. Klik \"Gå videre\".\n4. Trin 2 \"Tilpas opgaver\": kontrollér tabellen med kolonnerne Opgave, Type, Før og Efter. Klik \"Tilbage\", hvis noget skal rettes.\n5. Klik \"Gennemfør prisjustering (kan ikke fortrydes)\" for at opdatere priserne. Trin 3 bekræfter resultatet; klik \"Ny prisjustering\" for at starte forfra."
      },
      {
        "title": "Abonnementsoptimering — jævn arbejdsbyrden ud",
        "body": "Funktionen analyserer, hvordan aktive abonnementer fordeler sig på startuger, og foreslår at flytte nogle fra den travleste uge til den letteste.\n1. Gå til Funktioner → Abonnementsoptimering.\n2. Klik \"Kør optimering\" under \"Optimeringspotentiale\". Du ser fordelingen pr. uge og et forslag med kolonnerne Abo. nr., Kunde, Fra uge og Til uge.\n3. Klik \"Flyt abonnementer\", hvis du vil gennemføre forslaget.\n4. I dialogen \"Bekræft flytning af abonnementer\": vælg i \"Giv kunderne besked\", hvordan kunderne informeres (f.eks. \"Både SMS og e-mail\" eller \"Giv ikke besked\").\n5. Klik \"Flyt abonnementer\" for at bekræfte. Bemærk advarslen: \"Denne handling kan ikke fortrydes.\" Abonnementerne flyttes, og deres fremtidige ordrer genberegnes.\nStår der \"Ingen forslag — abonnementerne er allerede jævnt fordelt\", er der intet at gøre."
      },
      {
        "title": "Rapporter — grafer, nøgletal og download",
        "body": "Grafer og nøgletal:\n1. Gå til Rapportering → Grafer og nøgletal.\n2. Siden viser nøgletal for \"Antal kunder\", \"Omsætning\" og \"Abonnementskunder\" samt grafer og et kundekort. Ingen indtastning nødvendig — siden er kun til visning.\n\nDownload af rapporter:\n1. Gå til Rapportering → Rapporter.\n2. Under \"Hent ordrerapport\": vælg \"Startdato\" og \"Slutdato\" og klik \"Hent rapport\" for at downloade en ordrerapport i Excel-format.\n3. Under \"Hent abonnementer\": klik \"Hent rapport\" for at downloade alle aktive abonnementer i CSV-format."
      },
      {
        "title": "Rabatkoder — opret koder til online bestilling",
        "body": "Rabatkoder er procentvise koder, som kunder kan bruge ved online bestilling.\n1. Gå til Indstillinger → Rabatkoder.\n2. Klik \"Opret ny rabatkode\".\n3. Udfyld felterne \"Rabatkode\", \"Procentsats\" (1-100) og evt. \"Slutdato\".\n4. Klik \"Gem rabatkode\". Koden vises nu i tabellen med kolonnerne Rabatkode, Procentsats og Udløbsdato.\n5. Fjern en kode ved at klikke \"Slet\" ud for den."
      },
      {
        "title": "Standardopgaver — genbrugelige opgavetyper",
        "body": "Standardopgaver bruges overalt i systemet — retter du en standardopgave, slår ændringen igennem alle steder, hvor den er i brug.\n1. Gå til Indstillinger → Standardopgaver.\n2. Søg i feltet \"beskrivelse, kategori, bogstav\" og klik \"Søg\", eller sæt flueben i \"Vis også deaktive standardopgaver\" for at se alt.\n3. Klik \"Opret ny standardopgave\" for at tilføje en ny.\n4. Vælg \"Kategori\", skriv \"Beskrivelse\" og sæt evt. flueben ved \"Kunden skal være tilstede\".\n5. Klik \"Opret standardopgave\".\n6. Klik \"Deaktiver\" ud for en opgave, du ikke bruger længere — eller \"Reaktiver\" for at tage den i brug igen.\nBemærk: Opgaver mærket \"system\" er låste og kan hverken redigeres eller deaktiveres."
      }
    ],
    "tips": [
      "Brug altid \"Vis liste over modtagere\", før du sender en gruppebesked — så ser du præcis, hvem der får den.",
      "Både prisjustering og flytning af abonnementer kan IKKE fortrydes — tjek altid forhåndsvisningen, før du bekræfter.",
      "Opret ferier i god tid: en ferie skal oprettes mindst 1 uge før, den starter, og kan ikke redigeres eller slettes, når der er mindre end 1 uge til.",
      "Ferieplanlægning skubber kun abonnementsordrer — manuelle og online ordrer i ferieugerne skal du selv flytte.",
      "Kunderne får ikke automatisk besked om ferie — send en gruppebesked (f.eks. til \"Alle ordrer i en bestemt uge\") for at orientere dem."
    ]
  }
];
