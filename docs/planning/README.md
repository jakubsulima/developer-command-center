# Plan rozwoju aplikacji opartej na Projektach i Celach

## Zadania gotowe do przekazania czatowi

[Najważniejsze wdrożenia — pakiet z 8 września 2026](./priority-implementation-2026-09-08/README.md)
rozpisuje priorytety audytu na 9 osobnych planów. Zawiera kolejność, zależności,
zakres, kryteria odbioru i gotowe polecenia dla czatu wykonującego. Domyślny
pakiet obejmuje plany 01–07 i odbiór 09; capture offline (08) jest opcjonalny.

## Najnowszy przegląd możliwości rozwoju

[Audyt funkcjonalny i wizualny — 7 września 2026](./product-roadmap-audit-2026-09-07.md)
zawiera 32 propozycje z priorytetami, zależnościami, kryteriami odbioru i ryzykami.
Rozróżnia istniejące funkcje, niezamkniętą weryfikację oraz nowe pomysły; rozlicza
też zakres wcześniejszych planów 01–06. To punkt wejścia do wyboru kolejnych
prac, przy zachowaniu dotychczasowych decyzji domenowych.

## Aktywny kierunek

Fundament bezpieczeństwa zapisu, draftów, undo i potwierdzania ryzykownych
operacji jest już obecny. Dalszy rozwój nie kontynuuje modelu
`Commitment → Focus Session → Checkpoint`.

Zamknięty audyt użyteczności mobilnej znajduje się w dokumencie
[Plan poprawek mobilnych i produktywności](./mobile-productivity-remediation-2026-08-19.md)
i służy już tylko jako historia decyzji. Bieżące prace prowadzone są według
krótkich planów wdrożeniowych, w tym [uproszczenia szczegółu Celu i języka](./plan-05-goal-detail-and-language.md).

Plan pierwszego pionu AI, z bezpiecznym adapterem NVIDIA API/NIM, znajduje się w
dokumencie [AI z obsługą NVIDIA](./nvidia-ai-implementation.md). Zaczyna od
tylko-do-odczytu przeglądu wszystkich aktywnych Celów i rekomendacji na kolejny
tydzień. Mechanizm `AIProposal → approval → AIExecution` pozostaje przewidziany
dopiero dla późniejszych funkcji wykonujących mutacje.

Aktualnym źródłem decyzji produktowych jest dokument
[Trwałe Projekty i proste Cele](./project-centered-hierarchy.md). Wcześniejszy
dokument [Cele, działania cykliczne i wiedza](./goal-centric-redesign.md)
pozostaje zapisem etapu przejściowego.

## Kolejność realizacji

Wcześniejsze poprawki wynikające z audytu interfejsu są rozpisane w
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
