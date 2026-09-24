export function humanizeEntityReferences(text: string, labels: Array<[string, string]>) {
  const withEntityNames = labels.reduce((result, [id, label]) => result.includes(id) ? result.replaceAll(id, `„${label}”`) : result, text);
  const shortReferences = new Map<string, string | null>();
  for (const [id, label] of labels) {
    if (!/^[0-9a-f]{8}-/i.test(id)) continue;
    const prefix = id.slice(0, 8).toLowerCase();
    if (!shortReferences.has(prefix)) shortReferences.set(prefix, label);
    else if (shortReferences.get(prefix) !== label) shortReferences.set(prefix, null);
  }
  const withShortNames = withEntityNames.replace(/\b[0-9a-f]{8}\b/gi, (reference) => {
    const label = shortReferences.get(reference.toLowerCase());
    return label ? `„${label}”` : reference;
  });

  return withShortNames
    .replace(/\bgoalIds\b/gi, "Cele")
    .replace(/\bgoalId\b/gi, "Cel")
    .replace(/\bactionIds\b/gi, "Działania")
    .replace(/\bactionId\b/gi, "Działanie")
    .replace(/\bsignalKeys?\b/gi, "sygnały")
    .replace(/\bopenActions\b/gi, "otwarte Działania")
    .replace(/\bmimo 1 completed7Days\b/gi, "mimo jednego Działania ukończonego w ostatnich 7 dniach")
    .replace(/\bcompleted7Days\b/gi, "Działania ukończone w ostatnich 7 dniach")
    .replace(/\bcompleted28Days\b/gi, "Działania ukończone w ostatnich 28 dniach")
    .replace(/\brecentProgress\b/gi, "ostatnie wpisy postępu")
    .replace(/\blastActivityAt\b/gi, "data ostatniej aktywności")
    .replace(/\bprogress (?:entry|log)\b/gi, "wpis postępu")
    .replace(/\binactivity\b/gi, "nieaktywności")
    .replace(/\bmissing[_-]criteria\b/gi, "brak kryteriów sukcesu")
    .replace(/\bmissing[_-]next[_-]action\b/gi, "brak następnego Działania")
    .replace(/\bblocked[_-]actions\b/gi, "zablokowane Działania")
    .replace(/\boverdue[_-]actions\b/gi, "zaległe Działania")
    .replace(/\boverdue[_-]goal\b/gi, "przekroczony termin Celu")
    .replace(/\bdue[_-]soon\b/gi, "bliski termin")
    .replace(/\btoo[_-]many[_-]open[_-]actions\b/gi, "zbyt wiele otwartych Działań")
    .replace(/stallują/gi, "wstrzymują")
    .replace(/\b(brak)\s+brak\b/gi, "$1");
}
