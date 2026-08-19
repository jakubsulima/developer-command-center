# Plan rozwoju aplikacji opartej na Projektach i Celach

## Aktywny kierunek

Fundament bezpieczeństwa zapisu, draftów, undo i potwierdzania ryzykownych
operacji jest już obecny. Dalszy rozwój nie kontynuuje modelu
`Commitment → Focus Session → Checkpoint`.

Aktualny plan poprawy użyteczności mobilnej znajduje się w dokumencie
[Plan poprawek mobilnych i produktywności](./mobile-productivity-remediation-2026-08-19.md).
Najpierw domyka on dostęp do wszystkich sekcji, poprawne deep linki i reset
przewinięcia, a dopiero później skraca formularze i porządkuje warstwę
Tailwind/shadcn.

Aktualnym źródłem decyzji produktowych jest dokument
[Trwałe Projekty i proste Cele](./project-centered-hierarchy.md). Wcześniejszy
dokument [Cele, działania cykliczne i wiedza](./goal-centric-redesign.md)
pozostaje zapisem etapu przejściowego.

## Kolejność realizacji

Wszystkie aktywne poprawki wynikające z audytu interfejsu są rozpisane w
[backlogu technicznym UI/UX](./ui-ux-remediation-backlog.md). Backlog obejmuje
15 sprawdzonych kroków, zależności, kryteria akceptacji oraz podział AFK/HITL.

Każdy nowy sprint musi zakończyć się działającym pionowym przepływem w trybie
demo i Supabase. Nie wolno rozpoczynać kolejnego sprintu, dopóki migracja,
testy regresji i checkpointy HITL bieżącego sprintu nie są zamknięte.

## Znaczenie typów ticketów

- `AFK` — ticket może zostać zaimplementowany i zweryfikowany samodzielnie.
- `HITL` — implementacja powstaje w całości, ale zamknięcie wymaga krótkiej
  decyzji człowieka dotyczącej języka, hierarchii lub przebiegu.

## Stałe zasady nowego produktu

- Projekt jest trwałym kontenerem dla Celów, Zadań i Wiedzy.
- Cel jest prostym, możliwym do zamknięcia rezultatem i może należeć do Projektu.
- Działanie może być pojedyncze albo pochodzić z szablonu cyklicznego.
- Wykonanie działania nie wymaga timera ani Focus Session.
- Projekty, szablony celów i szablony cykliczne mogą być tworzone przez
  użytkownika.
- Wiedza działa globalnie i może być łączona z Projektami, Celami i Działaniami.
- Inbox zachowuje oryginalny capture niezależnie od wyniku triage.
- Historycznych Focus Sessions i Checkpointów nie usuwamy; pozostają do odczytu
  i w eksporcie, ale nowe nie są tworzone.
- Każda mutacja przechodzi przez typowaną, idempotentną komendę.
- Każda tabela w publicznym schemacie ma RLS, jawne granty i izolację
  Workspace'u.
- Managed Supabase pozostaje backendem docelowym, a tryb demo implementuje ten
  sam kontrakt.

## Wspólna Definition of Done

Ticket jest zakończony, gdy:

- dostarcza pełną ścieżkę użytkownika, a nie samą warstwę techniczną;
- tryb demo i Supabase zachowują się zgodnie;
- migracja jest addytywna, odtwarzalna i ma testy liczników oraz RLS;
- sukces, loading, empty, error i retry są jawne;
- operacje odwracalne oferują undo, a nieodwracalne bezpieczne potwierdzenie;
- desktop, mobile i klawiatura mają działającą podstawową ścieżkę;
- test obejmuje sukces, błąd i co najmniej jedną granicę domenową;
- `pnpm lint`, `pnpm typecheck`, `pnpm test` i build demo przechodzą;
- agent nie wdraża migracji zdalnie, nie tworzy commita i nie usuwa danych bez
  osobnego polecenia.

## Wskaźniki końcowe

- pierwszy Cel i Działanie w mniej niż 3 minuty;
- zwykłe Działanie można ukończyć jednym kliknięciem, bez rozpoczynania sesji;
- działanie cykliczne można utworzyć w mniej niż minutę;
- powrót po dłuższej przerwie nie tworzy lawiny zaległych wystąpień;
- własny Projekt i szablon nie wymagają zmiany kodu;
- capture tekstu lub linku trwa mniej niż 15 sekund;
- każdy historyczny Project, Learning Goal i Work Item jest dostępny po
  migracji jako Cel albo Działanie;
- aktywny interfejs nie używa pojęć Focus Session, Commitment, Work Item,
  Checkpoint ani Learning Evidence.
