# Sprint 2 — wspólny rdzeń Celów

## Cel sprintu

Project i Learning Goal zostają zastąpione w aktywnym produkcie jednym prostym
modelem Celu. Użytkownik może utworzyć dowolny Cel, dodać do niego pierwsze
Działanie i prowadzić postęp bez uruchamiania Focus Session. Istniejące dane są
migrowane bez utraty identyfikatorów, historii ani relacji.

## Rezultat demonstracyjny

Na istniejącym Workspace użytkownik widzi dotychczasowe projekty i cele nauki
na jednej liście Celów. Tworzy własny Cel z gotowego albo własnego szablonu,
dodaje Działanie, oznacza je jako ukończone i zapisuje krótką aktualizację
postępu. Historyczne Focus Sessions pozostają dostępne tylko do odczytu.

## Poza zakresem

- działania cykliczne i reguły dat;
- pełny redesign Inboxu i biblioteki Wiedzy;
- zewnętrzny kalendarz;
- usuwanie starych tabel Project, Learning Goal, Focus Session lub Checkpoint;
- automatyczne przepisywanie scratchpadów do Wiedzy;
- dowolny generator własnych pól formularza.

## Punkty startowe w repozytorium

- `docs/planning/goal-centric-redesign.md`
- `CONTEXT.md`
- `docs/adr/0002-focus-session-targets-one-work-item.md`
- `docs/adr/0003-commitment-instead-of-plan.md`
- `docs/adr/0004-focus-session-is-a-continuous-interval.md`
- `apps/web/src/domain/types.ts`
- `apps/web/src/app/store.tsx`
- `apps/web/src/data/localWorkspaceRepository.ts`
- `apps/web/src/data/supabaseRepository.ts`
- `apps/web/src/pages/ProjectsPage.tsx`
- `apps/web/src/pages/LearningPage.tsx`
- `apps/web/src/pages/CommandPage.tsx`
- `supabase/migrations/`

## G2-01 — Pierwszy Cel i Działanie we wspólnym modelu

**Typ:** HITL  
**Złożoność:** L  
**Blocked by:** Sprint 1

### Co zbudować

Dostarcz najmniejszą kompletną ścieżkę od pustego Workspace'u do utworzenia
Celu i pierwszego Działania. Ticket obejmuje nowy ADR supersedujący aktywne
założenia Focus/Commitment, aktualizację słownika domenowego, addytywny schemat,
typowaną komendę, implementacje demo/Supabase, formularz i test ścieżki.

Formularz używa prostych pytań: „Co chcesz osiągnąć?” i „Jaki jest pierwszy
krok?”. Typ celu jest opcjonalnym szablonem, nie osobnym cyklem pracy.

### Kryteria akceptacji

- [ ] Powstaje ADR opisujący Goal, Action, Area i odejście od obowiązkowego Focus.
- [ ] `CONTEXT.md` zawiera nową terminologię i jawnie oznacza stare terminy jako historyczne.
- [ ] Addytywna migracja tworzy minimalne tabele Goal/Action i nie usuwa danych.
- [ ] Nowe tabele mają RLS, jawne granty, indeksy `workspace_id` i złożone klucze Workspace.
- [ ] Atomowa, idempotentna komenda tworzy Cel wraz z opcjonalnym pierwszym Działaniem.
- [ ] Tryb demo i Supabase implementują ten sam kontrakt oraz rollback błędu.
- [ ] Pusty Workspace prowadzi do jednego prostego formularza bez pojęć Focus, Commitment i Work Item.
- [ ] Po zapisie użytkownik trafia na szczegóły Celu, nie do sesji pracy.
- [ ] Testy obejmują sukces, retry z tym samym idempotency key, błąd i izolację Workspace.

### Checkpoint HITL

Pokaż pusty Workspace na desktopie i mobile. Poproś o ocenę języka formularza,
liczby pól i tego, czy różnica między Celem a Działaniem jest oczywista.

## G2-02 — Bezpieczny backfill Projectów i Learning Goals

**Typ:** AFK  
**Złożoność:** L  
**Blocked by:** G2-01

### Co zbudować

Rozszerz migrację o idempotentny backfill istniejących Projectów i Learning
Goals do wspólnej projekcji Celów, wystaw tę projekcję przez kontrakt
repozytorium i pokaż minimalny podgląd zgodności za flagą nowego modelu. Zachowaj
te same `entity_id`, statusy, Outcome, kryteria, Area i znaczenie archiwizacji.
Migracja ma działać zarówno na pustej bazie, jak i na bazie zawierającej dane
Sprintu 1.

### Kryteria akceptacji

- [ ] Każdy Project ma dokładnie jeden odpowiadający Cel typu Projekt.
- [ ] Każdy Learning Goal ma dokładnie jeden odpowiadający Cel typu Nauka.
- [ ] Backfill zachowuje `entity_id`, tytuł, daty, Archive i Trash.
- [ ] Project Outcome trafia do rezultatu Celu, a demonstration criterion do kryteriów sukcesu.
- [ ] Powtórzenie backfillu nie tworzy duplikatów ani nie nadpisuje nowych zmian użytkownika.
- [ ] Migracja raportuje i testuje liczniki per Workspace przed przełączeniem odczytu.
- [ ] Relacja z innym Workspace'em jest blokowana przez klucze i RLS.
- [ ] Stare tabele pozostają nienaruszone i nadal mogą zasilić eksport awaryjny.
- [ ] Minimalny podgląd zgodności pokazuje zmigrowane Cele z obu źródeł w demo i Supabase.
- [ ] Błąd nowego odczytu jest jawny i nie uruchamia cichego fallbacku do starych danych.

## G2-03 — Jedna lista wszystkich Celów

**Typ:** HITL  
**Złożoność:** M  
**Blocked by:** G2-02

### Co zbudować

Zastąp osobne widoki Projekty i Nauka jedną listą Celów. Użytkownik widzi nazwę,
rezultat, stan, Obszar i najbliższe Działanie. Dostępne filtry to aktywne,
wstrzymane, osiągnięte, porzucone oraz typ szablonu. Dotychczasowe adresy mają
prowadzić do odpowiedniego Celu albo listy, bez martwych ekranów.

### Kryteria akceptacji

- [ ] Projecty i Learning Goals pojawiają się na jednej liście bez duplikatów.
- [ ] Domyślny widok pokazuje aktywne Cele i prostą akcję „Nowy cel”.
- [ ] Filtry mają stabilny stan w URL i czytelne empty states.
- [ ] Typ celu jest drugorzędną informacją, nie osobną nawigacją.
- [ ] Archive i Trash pozostają odwracalne oraz nie zmieniają stanu domenowego Celu.
- [ ] Stare trasy `/projects`, `/projects/:id` i `/learning` mają kontrolowane przekierowania.
- [ ] Lista działa na mobile, klawiaturze i przy długich polskich nazwach.
- [ ] Test obejmuje zmieszane dane legacy i nowe oraz brak wycieku między Workspace'ami.

### Checkpoint HITL

Pokaż listę z co najmniej jednym celem projektowym, edukacyjnym i własnym.
Oceń, czy lista wygląda jak jeden produkt, a nie połączone mechanicznie moduły.

## G2-04 — Własne Obszary i szablony Celów

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** G2-03

### Co zbudować

Pozwól utworzyć własny Obszar oraz prosty szablon Celu. Gotowe szablony Projekt,
Nauka, Cel osobisty, Utrzymanie i Pusty cel są propozycjami możliwymi do
sklonowania. Własny szablon przechowuje język rezultatu, kryteriów i opcjonalne
domyślne Działania, ale nie dowolny schemat ani wykonywalny kod.

### Kryteria akceptacji

- [ ] Użytkownik może utworzyć, edytować i zarchiwizować Obszar.
- [ ] Cel może mieć jeden główny Obszar albo pozostać bez Obszaru.
- [ ] Użytkownik może utworzyć szablon od zera albo sklonować gotowy.
- [ ] Gotowego szablonu systemowego nie można zmienić globalnie; edycja tworzy kopię Workspace'u.
- [ ] Archiwizacja Obszaru lub szablonu nie usuwa istniejących Celów.
- [ ] Własny szablon może dostarczyć domyślne Działania, które użytkownik zatwierdza przed utworzeniem.
- [ ] UI domyślnie nie wymaga wyboru Obszaru ani szablonu.
- [ ] RLS i testy potwierdzają, że szablon nie jest widoczny w innym Workspace.

## G2-05 — Prowadzenie Działań bez Focus Session

**Typ:** HITL  
**Złożoność:** L  
**Blocked by:** G2-03

### Co zbudować

Na szczegółach Celu pozwól tworzyć, edytować, porządkować, blokować, kończyć,
pomijać i anulować Działania bez rozpoczynania sesji. Jedno Działanie można
oznaczyć jako następne. Akcja ukończenia ma być szybka, odwracalna i od razu
widoczna w historii Celu.

### Kryteria akceptacji

- [ ] Użytkownik może ukończyć Działanie bez timera, modala checkpointu i nawigacji do `/focus`.
- [ ] Utworzenie i edycja działają w demo i Supabase przez typowane komendy.
- [ ] Można jawnie wskazać następne Działanie spośród elementów gotowych do pracy.
- [ ] Zablokowanie wymaga krótkiego powodu, a odblokowanie go zachowuje w historii.
- [ ] Ukończenie, pominięcie i anulowanie mają właściwe, różne znaczenie.
- [ ] Ukończenie oferuje undo i jest odporne na podwójne kliknięcie.
- [ ] Kolejność nie zmienia historii ukończonych elementów.
- [ ] Testy obejmują wszystkie stany, konflikt wersji, rollback i dostępność klawiaturą.

### Checkpoint HITL

Pokaż szczegóły Celu i ścieżkę dodania oraz ukończenia Działania. Oceń, czy
interakcja jest wystarczająco lekka i nie przypomina ukrytej Focus Session.

## G2-06 — Postęp Celu i historyczny Focus tylko do odczytu

**Typ:** AFK  
**Złożoność:** L  
**Blocked by:** G2-02, G2-05

### Co zbudować

Dodaj prostą Aktualizację postępu Celu oraz zmigruj Learning Evidence i Context
Checkpointy do wspólnej osi czasu. Historyczne Focus Sessions i scratchpady
pozostają osiągalne z wpisu historii, ale aplikacja nie pozwala tworzyć nowych.

### Kryteria akceptacji

- [ ] Użytkownik może dodać aktualizację: notatkę, decyzję, rezultat, dowód albo blocker.
- [ ] Wpis może opcjonalnie wskazać Działanie i element Wiedzy.
- [ ] Learning Evidence oraz Checkpoint mają zachowaną treść, datę, źródło i identyfikator legacy.
- [ ] Scratchpad nie staje się automatycznie Wiedzą ani nową aktualizacją.
- [ ] Historyczna sesja pokazuje czas i treść tylko do odczytu.
- [ ] Nowe komendy i UI nie tworzą Focus Session ani Context Checkpointu.
- [ ] Eksport zawiera zarówno nową projekcję, jak i dane historyczne.
- [ ] Testy liczników potwierdzają pełność migracji i brak podwójnych wpisów.

## Kolejność wykonania

1. G2-01
2. G2-02
3. G2-03
4. G2-04 i G2-05
5. G2-06
6. Scenariusz końcowy: dane legacy → lista Celów → szczegóły → ukończenie Działania → aktualizacja postępu

## Kontrole jakości

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
VITE_DATA_BACKEND=demo pnpm build
pnpm supabase:plan
```

Migracje uruchom na izolowanej lokalnej bazie od zera i na fixture reprezentującej
stan po Sprincie 1. Sprawdź liczniki backfillu, RLS, idempotencję komend,
przekierowania starych tras oraz eksport. Nie wdrażaj zdalnie bez osobnej zgody.

## Prompt startowy dla kolejnego chatu

```text
Zrealizuj Sprint 2 opisany w docs/planning/sprint-2-goals-foundation.md.
Przeczytaj cały plan, goal-centric-redesign.md, CONTEXT.md, ADR 0001–0005 oraz
design system. Zachowaj istniejące zmiany. Realizuj tickety w kolejności jako
pionowe wycinki demo + Supabase + UI + testy. Zatrzymaj się na checkpointach
HITL G2-01, G2-03 i G2-05. Nie wdrażaj migracji zdalnie, nie usuwaj tabel
legacy i nie twórz commita bez osobnego polecenia.
```
