// Datatyper til månedsrapporten (adskilt så klient- og testfiler kan importere
// typerne uden at trække @react-pdf/renderer med ind).
export type RapportBesog = {
  datoTekst: string;
  opgaver: string[];
  fotos: string[]; // offentlige Blob-URL'er (allerede kontakt-filtreret af kaldende kode)
};

export type RapportData = {
  kundeNavn: string;
  maanedLabel: string; // fx "September 2026"
  hilsenNavn: string; // kontaktpersonens fornavn
  besoeg: RapportBesog[];
};
