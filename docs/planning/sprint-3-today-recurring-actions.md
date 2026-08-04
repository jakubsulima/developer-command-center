# Sprint 3 — Dzisiaj i działania cykliczne

## Cel sprintu

Widok Dzisiaj ma pokazywać właściwe Działania bez narzucania timera. Użytkownik
może tworzyć działania cykliczne powiązane z Celem albo Obszarem, budować własne
szablony oraz decydować, co stanie się z pominiętymi terminami.

## Rezultat demonstracyjny

Użytkownik tworzy cotygodniowe Działanie „Przegląd budżetu”, łączy je z własnym
Obszarem Finanse i materiałem z Wiedzy. W dniu wykonania wystąpienie pojawia się
w Dzisiaj. Można je ukończyć, pominąć, przełożyć albo zmienić tylko to
wystąpienie bez naruszania serii. Po dłuższej nieobecności aplikacja nie tworzy
lawiny zaległych rekordów.

## Poza zakresem

- pełny kalendarz miesięczny i widok Gantta;
- synchronizacja Google/Outlook Calendar;
- nawyki z punktami, seriami dni i grywalizacją;
- zależności między Działaniami;
- publiczny marketplace szablonów;
- dowolny parser RRULE wpisywany ręcznie przez użytkownika;
- automatyczne wykonywanie Działań przez AI.

## Punkty startowe w repozytorium

- `docs/planning/goal-centric-redesign.md`
- `docs/planning/sprint-2-goals-foundation.md`
- nowy model Goal/Action/Area po Sprincie 2
- `apps/web/src/pages/CommandPage.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/RightRail.tsx`
- `apps/web/src/app/store.tsx`
- `apps/web/src/data/localWorkspaceRepository.ts`
- `apps/web/src/data/supabaseRepository.ts`
- `supabase/migrations/`

## G3-01 — Pierwsze Działanie cykliczne widoczne w Dzisiaj

**Typ:** HITL  
**Złożoność:** L  
**Blocked by:** Sprint 2

### Co zbudować

Dostarcz pełną ścieżkę utworzenia prostego dziennego albo tygodniowego szablonu
cyklicznego i wygenerowania jego pierwszego wystąpienia jako zwykłego
Działania. Seria może wskazywać Cel, Obszar albo pozostać samodzielna.
Wystąpienie pojawia się w Dzisiaj i korzysta ze zwykłej komendy ukończenia.

### Kryteria akceptacji

- [ ] Addytywna migracja tworzy szablony cykliczne oraz pola pochodzenia wystąpienia.
- [ ] Szablon przechowuje strefę czasową, datę początku, stan i prostą regułę dzienną/tygodniową.
- [ ] Unikalność `(recurring_template_id, occurrence_date)` blokuje duplikaty.
- [ ] Komenda `security invoker` materializuje wystąpienia tylko w bieżącym Workspace.
- [ ] Formularz wymaga wyłącznie nazwy, częstotliwości i początku; pozostałe pola są opcjonalne.
- [ ] Wystąpienie jest zwykłym Działaniem i może być ukończone bez osobnego mechanizmu.
- [ ] Ukończenie wystąpienia nie wyłącza ani nie przesuwa serii.
- [ ] Demo i Supabase mają identyczny wynik dla kontrolowanej daty.
- [ ] Testy obejmują ponowną materializację, zmianę strefy i RLS.

### Checkpoint HITL

Pokaż utworzenie serii i jej pierwsze wystąpienie na desktopie oraz mobile.
Oceń, czy użytkownik rozumie różnicę między serią a dzisiejszym Działaniem.

## G3-02 — Dzisiaj bez timera

**Typ:** HITL  
**Złożoność:** L  
**Blocked by:** G3-01

### Co zbudować

Zastąp Command nowym widokiem Dzisiaj. Pokazuje Działania zaplanowane na dziś,
zaległe oraz ręcznie przypięte bez daty. Użytkownik może ukończyć, otworzyć,
przełożyć albo pominąć element bez uruchamiania sesji. Nadchodzące Działania są
widoczne tylko jako krótki kontekst.

### Kryteria akceptacji

- [ ] Główna akcja nie rozpoczyna Focus i nie pokazuje licznika czasu.
- [ ] Sekcje Na dziś, Zaległe i Nadchodzące mają jasne reguły oraz empty states.
- [ ] Działanie bez daty może zostać ręcznie przypięte do Dzisiaj.
- [ ] Ukończenie jest dostępne jednym kliknięciem i oferuje undo.
- [ ] Przełożenie zmienia jedno wystąpienie, nie całą serię.
- [ ] Pominięcie jest dostępne wyłącznie dla wystąpienia cyklicznego i zachowuje historię.
- [ ] Widok nie miesza ukończonych elementów z bieżącymi bez świadomego filtra.
- [ ] Mobile mieści podstawowe akcje bez poziomego przewijania.
- [ ] Testy używają kontrolowanego czasu na granicy północy Workspace'u.

### Checkpoint HITL

Pokaż Dzisiaj ze zwykłym, cyklicznym, zaległym i przypiętym Działaniem. Oceń
hierarchię, liczbę akcji i czy ekran odpowiada na pytanie „co mogę zrobić?”.

## G3-03 — Pełne reguły tygodniowe, miesięczne i własny interwał

**Typ:** AFK  
**Złożoność:** L  
**Blocked by:** G3-01

### Co zbudować

Rozszerz serię o interwał co N dni/tygodni/miesięcy, wybrane dni tygodnia,
dzień miesiąca, opcjonalny koniec i podgląd kolejnych wystąpień. Formularz nie
udostępnia surowego RRULE. Reguła miesięczna dla nieistniejącego dnia używa
ostatniego poprawnego dnia miesiąca.

### Kryteria akceptacji

- [ ] Można wybrać kilka dni tygodnia i interwał większy niż jeden.
- [ ] Reguła miesięczna poprawnie obsługuje 29, 30 i 31 dzień oraz lata przestępne.
- [ ] Użytkownik widzi co najmniej trzy następne daty przed zapisem.
- [ ] Początek, koniec i obliczenia używają strefy Workspace'u, również przy zmianie DST.
- [ ] Niedozwolona albo pusta reguła nie jest zapisywana.
- [ ] Edycja reguły nie zmienia ukończonych i przeszłych wystąpień.
- [ ] Testy tabelaryczne obejmują dzienną, tygodniową, miesięczną, interwał, DST i rok przestępny.

## G3-04 — Edycja wystąpienia i przyszłej serii

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** G3-02, G3-03

### Co zbudować

Pozwól edytować tylko jedno wystąpienie albo „to i przyszłe”. Zmiana pojedyncza
nie modyfikuje szablonu. Zmiana przyszłej serii aktualizuje szablon, usuwa lub
aktualizuje wyłącznie nieukończone przyszłe wystąpienia i zachowuje historię.

### Kryteria akceptacji

- [ ] UI zawsze pyta o zakres zmiany, gdy edytowane pole pochodzi z serii.
- [ ] „Tylko to” pozwala zmienić nazwę, termin, checklistę i powiązania jednego Działania.
- [ ] „To i przyszłe” nie zmienia zakończonych, pominiętych ani przeszłych rekordów.
- [ ] Przesunięcie jednego wystąpienia nie tworzy drugiego dla pierwotnej daty.
- [ ] Wstrzymanie serii zatrzymuje materializację, a wznowienie liczy od poprawnej następnej daty.
- [ ] Archiwizacja serii zachowuje wszystkie istniejące wystąpienia.
- [ ] Błąd częściowej zmiany wykonuje rollback albo pozostawia jawny stan do ponowienia.
- [ ] Testy obejmują edycję równoległą, idempotency retry i podwójne kliknięcie.

## G3-05 — Bezpieczna polityka zaległych wystąpień

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** G3-03

### Co zbudować

Dodaj dwie polityki: `skip_missed` oraz `carry_one`. Pierwsza nie materializuje
starych wystąpień po przerwie, druga zachowuje najwyżej jedno zaległe. Zmiana
polityki pokazuje wpływ na przyszły backlog i nie usuwa historii.

### Kryteria akceptacji

- [ ] `skip_missed` jest bezpieczną wartością domyślną.
- [ ] `carry_one` nigdy nie tworzy więcej niż jednego zaległego Działania dla serii.
- [ ] Otwarcie aplikacji po 90 dniach nie tworzy nieograniczonej liczby rekordów.
- [ ] Użytkownik widzi informację, ile terminów zostało pominiętych przez politykę.
- [ ] Zmiana polityki nie retroaktywnie modyfikuje ukończonej historii.
- [ ] Materializacja ma ograniczony horyzont i czas wykonania.
- [ ] Testy używają kontrolowanego czasu dla krótkiej i bardzo długiej nieobecności.

## G3-06 — Własne szablony cykliczne i checklisty

**Typ:** HITL  
**Złożoność:** M  
**Blocked by:** G3-04

### Co zbudować

Dodaj bibliotekę gotowych propozycji oraz szablony użytkownika. Gotowy szablon
nie aktywuje się sam; użytkownik kopiuje go do Workspace'u i może zmienić.
Szablon może zawierać prostą checklistę oraz domyślny Cel albo Obszar.

### Kryteria akceptacji

- [ ] Dostępne są przykłady: przegląd celów, budżet, powtórka materiału, backup i Inbox.
- [ ] Żaden gotowy szablon nie tworzy serii bez jawnego potwierdzenia użytkownika.
- [ ] Użytkownik może utworzyć szablon od zera i ponownie go wykorzystać.
- [ ] Checklista jest kopiowana do wystąpienia, a późniejsza edycja szablonu nie zmienia historii.
- [ ] Własny szablon może być samodzielny albo domyślnie wskazywać Cel/Obszar.
- [ ] Archive i Trash zachowują istniejące serie oraz wystąpienia zgodnie z ich stanem.
- [ ] Szablony są izolowane per Workspace i objęte wyszukiwaniem.
- [ ] Testy obejmują kopiowanie gotowego szablonu i brak automatycznej aktywacji.

### Checkpoint HITL

Pokaż bibliotekę i utworzenie własnego szablonu. Oceń, czy użytkownik nie myli
propozycji, szablonu, aktywnej serii i pojedynczego wystąpienia.

## G3-07 — Materiały z Wiedzy przy serii i wystąpieniu

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** G3-06

### Co zbudować

Pozwól podpiąć elementy Wiedzy jako instrukcje lub materiały pomocnicze do
szablonu cyklicznego. Wystąpienie pokazuje aktualne materiały serii oraz własne
dodatkowe linki. Odłączenie materiału nie usuwa samego elementu Wiedzy.

### Kryteria akceptacji

- [ ] Do serii można podpiąć wiele elementów Wiedzy przez istniejące relacje encji.
- [ ] Materiały są widoczne z Dzisiaj bez opuszczania kontekstu Działania.
- [ ] Jedno wystąpienie może mieć dodatkowe materiały bez zmiany serii.
- [ ] Odłączenie relacji nie archiwizuje ani nie usuwa Wiedzy.
- [ ] Element z innego Workspace'u nie może zostać powiązany.
- [ ] Brak materiałów nie tworzy pustej sekcji.
- [ ] Testy obejmują relacje serii, override wystąpienia i RLS.

## Kolejność wykonania

1. G3-01
2. G3-02 i G3-03
3. G3-04 i G3-05
4. G3-06
5. G3-07
6. Scenariusz końcowy: własny szablon → aktywna seria → Dzisiaj → przełożenie → ukończenie → kolejna data

## Kontrole jakości

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
VITE_DATA_BACKEND=demo pnpm build
pnpm supabase:plan
```

Użyj zegara kontrolowanego w testach. Manualnie sprawdź zmianę dnia, strefę
Europe/Warsaw, DST, 31 dzień miesiąca, powrót po 90 dniach, dwa równoległe taby,
mobile 320 px oraz retry materializacji. Nie wdrażaj migracji zdalnie bez zgody.

## Prompt startowy dla kolejnego chatu

```text
Zrealizuj Sprint 3 opisany w docs/planning/sprint-3-today-recurring-actions.md.
Przeczytaj cały plan, goal-centric-redesign.md, Sprint 2, CONTEXT.md oraz ADR
nowego modelu. Załóż, że Sprint 2 jest ukończony, ale zweryfikuj migracje i
kontrakty. Realizuj pionowe tickety demo + Supabase + UI + testy w kolejności.
Zatrzymaj się na HITL G3-01, G3-02 i G3-06. Nie wdrażaj zdalnie i nie twórz
commita bez osobnego polecenia.
```

