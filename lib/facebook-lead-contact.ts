export function isFacebookLeadSource(source: string): boolean {
  return /(^|[^a-z])(facebook|meta)([^a-z]|$)/i.test(source.trim());
}

export function facebookLeadSmsMessage(name: string): string {
  const safeName = name.replace(/[\r\n]+/g, " ").trim().slice(0, 80);
  return `Hej ${safeName}, tak for din henvendelse på vores kampagne om vinduesvask. Hvor mange vinduer og døre har du, og hvor ofte ønsker du, at vi kommer? Udvendigt tilbyder vi intervaller på hver 4., 6., 8. eller 12. uge. Indvendigt tilbyder vi hver 3. eller 6. måned.\n\nMvh Thomas\nwww.karltoffel.dk`;
}
