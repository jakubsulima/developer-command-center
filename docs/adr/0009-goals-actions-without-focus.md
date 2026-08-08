# Goal i Action zastępują obowiązkowy Focus oraz osobne moduły rezultatu

## Status

Accepted. Supersedes ADR 0002, ADR 0003, ADR 0004 and the active-product part
of ADR 0007. Those decisions still explain immutable historical records.

## Decision

Aktywny produkt używa wspólnego **Goal** dla projektów, nauki, spraw osobistych
i utrzymania. **Area** jest opcjonalnym, własnym kontekstem. **Action** jest
zwykłym krokiem, który można prowadzić i ukończyć bez Focus Session, timera lub
obowiązkowego Context Checkpointu.

Typ Celu jest szablonem języka i proponowanych Działań, nie osobnym cyklem
pracy. Dzisiaj jest projekcją terminów oraz ręcznych przypięć. Powtarzalność
należy do szablonu serii; każde wystąpienie jest zwykłym Action.

Project, Learning Goal, Work Item, Commitment, Focus Session, Context
Checkpoint, Learning Evidence i Review pozostają w schemacie oraz eksporcie.
Addytywny backfill zachowuje ich identyfikatory i wystawia dane w nowym modelu.
Aktywny interfejs nie tworzy już nowych rekordów historycznych typów.

## Consequences

Użytkownik ma jeden prosty model wyniku i kroku, może definiować własne Obszary
oraz szablony i nie musi przyjmować metody opartej na sesjach czasowych. Kosztem
jest przejściowa podwójna reprezentacja w bazie, jawna warstwa zgodności i
konieczność utrzymania historycznego eksportu do czasu osobnej decyzji o
retencji danych legacy.
