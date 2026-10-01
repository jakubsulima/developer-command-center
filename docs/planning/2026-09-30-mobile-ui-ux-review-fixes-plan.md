# Plan poprawek po review mobilnego UI i UX

Data: 30 września 2026. Status: wdrożono wszystkie cztery etapy; lokalne testy, lint, typecheck, build demo i podgląd mobilny zakończone. Próby na rzeczywistym telefonie i zdalnym Supabase pozostają niewykonane.

Plan zamyka cztery błędy znalezione po zmianach Luny. Celem jest niezawodne codzienne korzystanie: cofanie ukończenia, stabilne dodawanie wpisów i czytelne filtry. Ponowny odczyt kodu potwierdził, że wszystkie cztery problemy nadal występują. Kierunek wyglądu i animacji pozostaje zgodny z [planem mobilnego UI i UX](./2026-09-30-mobile-ui-ux-plan.md).

## Kolejność realizacji

| Etap | Problem | Oczekiwany efekt | Status |
| --- | --- | --- |
| 1 | Cofnięcie ukończenia gubi oznaczenie następnego kroku | Działanie odzyskuje wcześniejszy stan i oznaczenie, o ile inny krok nie jest już wybrany | Wdrożono; testy domeny, zapisu demo, konfliktów i migracji przechodzą |
| 2 | Formularz otwarty podczas ładowania widoku znika po jego załadowaniu | Tymczasowy ekran nie pozwala rozpocząć formularza, którego nie potrafi utrzymać | Wdrożono; regresja z opóźnionym importem przechodzi |
| 3 | Wyczyszczenie opisu automatycznie zwija jego pole | Użytkownik sam decyduje o rozwinięciu opcjonalnego opisu | Wdrożono; testy tekstu, fokusu, szkicu, zwijania ręcznego i typu wpisu przechodzą |
| 4 | Status nie jest uwzględniony w aktywnych filtrach | Licznik, etykiety i czyszczenie obejmują każdy wybrany filtr | Wdrożono; testy licznika, etykiet, czyszczenia i historii przeglądarki przechodzą |

Każdy etap kończy się trwałym testem regresji. Etapy 2–4 nie zależą od etapu 1 i mogą zostać dostarczone wcześniej, jeśli poprawa zapisu cofania wymaga dodatkowej pracy.

## Etap 1 Przywracanie następnego kroku przy cofnięciu

**Źródło błędu:** `completeActionWithUndo` zapamiętuje status, blokadę i termin przeglądu, ale pomija `isNext`. Ukończenie usuwa to oznaczenie, a zmiana statusu z powrotem go nie odtwarza.

**Zmiany do wykonania:**

1. Zapamiętać pełny stan potrzebny do cofnięcia: identyfikator i wersję Działania, Cel, status, blokadę, termin przeglądu oraz `isNext`.
2. Wprowadzić wspólną operację cofania w warstwie komend i store. Komponenty mają wywoływać tę operację, zamiast samodzielnie wykonywać dwie niezależne mutacje.
3. Zachować kontrolę wersji: jeśli Działanie zostało zmienione po ukończeniu, cofnięcie nie może nadpisać tej zmiany. W razie konfliktu odświeżyć dane i wyświetlić komunikat.
4. Jeśli wcześniej było to następne Działanie i nadal spełnia warunki tego oznaczenia, przywrócić `isNext`, gdy żadne inne Działanie w Celu nie jest aktualnie wybrane. Jeśli wybrane jest inne, cofnąć status i zachować ten wybór.
5. Zapewnić spójny zapis statusu i oznaczenia w demo oraz w Supabase. Istniejące `setNextAction` nie przyjmuje oczekiwanej wersji, więc samo dopisanie go po `setActionStatus` nie zapewnia bezpiecznego cofania. Dla zapisu zdalnego potrzebna jest operacja transakcyjna z kontrolą wersji i wspólną synchronizacją z wyborem następnego kroku.
6. Obsłużyć ponowienie tej samej operacji bez ponownego zastosowania cofnięcia. Potwierdzenie sukcesu pokazywać po udanym zapisie; błąd nie może pozostawić częściowo cofniętych danych.

**Mapa kodu:** [completeActionWithUndo.ts](/Users/jakub/Documents/project-learning-app/apps/web/src/components/completeActionWithUndo.ts), [store-context.ts](/Users/jakub/Documents/project-learning-app/apps/web/src/app/store-context.ts), [store.tsx](/Users/jakub/Documents/project-learning-app/apps/web/src/app/store.tsx), [commands.ts](/Users/jakub/Documents/project-learning-app/apps/web/src/domain/commands.ts), [supabaseRepository.ts](/Users/jakub/Documents/project-learning-app/apps/web/src/data/supabaseRepository.ts). Zachować wspólne zachowanie na Starcie, liście Działań, szczególe Celu i szczególe Działania. Jeśli potrzebna jest nowa migracja, przygotować ją jako część tego etapu.

**Testy odbioru:**

- Następne Działanie → ukończenie → Cofnij: wcześniejszy status i `isNext` wracają, także po ponownym wczytaniu danych.
- Zwykłe Działanie → ukończenie → Cofnij: nie otrzymuje oznaczenia następnego kroku.
- Po ukończeniu A użytkownik wybiera B jako następne: cofnięcie A zachowuje wybór B.
- Późniejsza edycja tego samego Działania powoduje konflikt, bez nadpisania danych.
- Błąd zapisu, ponowienie i równoczesny wybór następnego kroku nie prowadzą do częściowego cofnięcia ani dwóch oznaczonych Działań.

## Etap 2 Bezpieczny ekran ładowania

**Źródło błędu:** `AppRouteLoading` ma własny interaktywny `AppShell`. Po rozwiązaniu `Suspense` ten komponent zostaje usunięty razem z otwartym Quick Add.

**Decyzja dla tego pakietu:** dodać jawny tryb ładowania do istniejącego `AppShell`. Na tym etapie nie przenosić wszystkich stron do nowego wspólnego layoutu. Trwały shell poza `Suspense` może być osobnym usprawnieniem, jeśli dodawanie w trakcie ładowania stanie się wymaganiem produktu.

**Zmiany do wykonania:**

1. W `AppRouteLoading` włączyć tryb ładowania shella, zachowując jego wymiary, nawigację i komunikat „Ładowanie widoku”.
2. W tym trybie wyłączyć „Dodaj” oraz wejścia do tymczasowych paneli wyszukiwania i „Więcej”/profilu. Nie usuwać przycisków z układu; oznaczyć ich niedostępność również dla technologii asystujących.
3. Zablokować również skróty klawiaturowe i zdarzenie `app-shell:quick-add`, żeby nie omijały wyłączenia przycisku.
4. Po załadowaniu strony udostępnić zwykły shell i poprawny kontekst dodawania dla tej strony. Nie uruchamiać automatycznie formularza na podstawie kliknięcia z ekranu ładowania.

**Mapa kodu:** [AppRouteLoading.tsx](/Users/jakub/Documents/project-learning-app/apps/web/src/components/AppRouteLoading.tsx), [AppShell.tsx](/Users/jakub/Documents/project-learning-app/apps/web/src/components/AppShell.tsx), [App.tsx](/Users/jakub/Documents/project-learning-app/apps/web/src/app/App.tsx).

**Testy odbioru:** sztucznie opóźnić załadowanie strony. Przyciski, skróty i zdarzenie nie otwierają formularza ani panelu w fallbacku. Po załadowaniu „Dodaj” działa, ma kontekst właściwego Celu/Projektu, a wpisany szkic pozostaje podczas zwykłego ponownego renderowania. Nie pojawiają się skoki układu.

## Etap 3 Stabilne rozwijanie opisu w Quick Add

**Źródło błędu:** stan `open` sekcji opisu zależy od `detail.trim()`. Usunięcie ostatniego znaku zwija sekcję podczas edycji.

**Zmiany do wykonania:**

1. Oddzielić stan rozwinięcia sekcji od treści szkicu. Kliknięcie nagłówka sekcji zmienia stan widoczności; wpisywanie i usuwanie tekstu go nie zmienia.
2. Przy rozpoczęciu sesji formularza automatycznie pokazać opis odtworzony z niepustego szkicu. Nie otwierać go ponownie przy każdej zmianie tekstu po ręcznym zwinięciu.
3. Wariant z wymaganym opisem musi zawsze pokazywać pole. Przy zmianie typu wpisu lub klucza szkicu ustawić widoczność zgodnie z nowym wariantem, bez kasowania danych.
4. Zachować aktywne pole, kursor i klawiaturę po usunięciu ostatniego znaku. Nie wymuszać ponownego montowania pola przez zmienny `key` zależny od treści.

**Mapa kodu:** [QuickAdd.tsx](/Users/jakub/Documents/project-learning-app/apps/web/src/components/QuickAdd.tsx), [QuickAdd.test.tsx](/Users/jakub/Documents/project-learning-app/apps/web/src/components/QuickAdd.test.tsx).

**Testy odbioru:** rozwinąć pusty opis, wpisać tekst, usunąć go w całości i od razu wpisać nowy. Pole pozostaje widoczne i aktywne. Sprawdzić także ręczne zwijanie, odtworzony szkic, zmianę typu wpisu i wymagany opis. Potwierdzić zachowanie z otwartą klawiaturą na telefonie.

## Etap 4 Kompletne oznaczenie aktywnych filtrów

**Źródło błędu:** `hasFilters`, `filterCount`, etykiety i `clearFilters` uwzględniają termin, Projekt i Cel, ale pomijają wybrany status.

**Zmiany do wykonania:**

1. Przyjąć jedno źródło prawdy: parametr `view`. Każdy widok różny od domyślnego `open` jest jednym aktywnym filtrem, niezależnie od tego, czy oznacza termin, czy status.
2. Wyliczać licznik jako aktywny widok + Projekt + Cel. Nie sumować statusu i terminu jako dwóch filtrów, ponieważ obecnie korzystają z tego samego parametru.
3. Wyświetlać etykietę aktualnego widoku również dla statusów, np. „Ukończone”. Licznik i etykiety mają pozostać widoczne po zwinięciu panelu.
4. „Wyczyść filtry” usuwa `view`, `project` i `goal`, przywraca „Otwarte” oraz aktualizuje listę. Pozostałe parametry adresu zachować; `highlight` nie jest filtrem i nie wlicza się do licznika.
5. Wyliczać oznaczenia z adresu również po wejściu przez bezpośredni link oraz użyciu Wstecz/Dalej.

**Mapa kodu:** [ActionsPage.tsx](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/ActionsPage.tsx), [ActionsPage.test.tsx](/Users/jakub/Documents/project-learning-app/apps/web/src/app/ActionsPage.test.tsx).

**Testy odbioru:** „Ukończone” daje licznik 1 i widoczną etykietę; status + Projekt + Cel daje 3. Czyszczenie wraca do otwartych Działań i licznika 0. Sprawdzić statusy, Dzisiaj/Zaległe, bezpośrednie adresy, Wstecz/Dalej oraz pusty wynik filtrowania.

## Weryfikacja całego pakietu

Podczas wcześniejszego review przeszły lint, typecheck, build demo oraz 122 testy w dziewięciu wybranych plikach. Nie był to pełny zestaw testów. Tymczasowe próby reprodukcji wykazały pierwsze trzy błędy, a czwarty potwierdzono w przeglądarce. Wdrożenie ma dodać trwałe regresje; samo powtórzenie dotychczasowych testów nie wystarczy.

1. **Testy:** `pnpm test` — 71 plików i 502 testy przeszły. Zawiera testy cofania, Quick Add, filtrów, ładowania shella i migracji; dodatkowy przebieg ukierunkowanych regresji dał 94/94.
2. **Kontrole kodu:** `pnpm lint`, `pnpm typecheck` i `pnpm build` przeszły. Lint nie zgłosił ostrzeżeń.
3. **Podgląd:** aplikacja załadowała się w przeglądarce. Widok Działań z aktywnym statusem sprawdzono przy 320, 390 i 430 px; przy 320 px sprawdzono też otwarty Quick Add. Po zwinięciu filtrów chip statusu i licznik pozostały widoczne. Stan wolnego ładowania sprawdzono przez test opóźnionego importu. Panel przeglądarki nie udostępnił emulacji `prefers-reduced-motion` ani odczytu konsoli; nie oznaczam tych prób jako wykonanych. Polecenie `agent-browser` nie było zainstalowane, więc podgląd wykonano w przeglądarce Codex.
4. **Telefon:** edycji opisu z natywną klawiaturą i dolnych przycisków nie sprawdzono na rzeczywistym telefonie.
5. **Trwałość:** cofnięcie po ponownym odczycie i błąd zapisu sprawdzono w demo. Testy migracji, transakcji, konfliktu wersji i wyboru innego następnego kroku przeszły w lokalnym środowisku testowym. Zdalnego/testowego projektu Supabase nie użyto, więc zapis do prawdziwego Supabase pozostaje nieweryfikowany.

## Warunki zakończenia

- [x] Cztery scenariusze reprodukcji są naprawione i objęte trwałymi testami.
- [x] Cofanie nie gubi oznaczenia ani nie nadpisuje innego aktualnie wybranego następnego kroku.
- [x] Ekran ładowania nie pozwala otworzyć formularza, który zaraz zniknie.
- [x] Puste pole opisu pozostaje otwarte podczas edycji.
- [x] Każdy aktywny status jest widoczny i można go wyczyścić.
- [x] Raport podaje wyniki wykonanych kontroli oraz ewentualne niewykonane próby.

**Kontrole niewykonane:** rzeczywisty telefon, wizualna emulacja ograniczonego ruchu, odczyt błędów konsoli oraz zdalne/testowe środowisko Supabase.

Zmiany należy nakładać na istniejącą pracę Luny, zachowując pozostałe lokalne modyfikacje. Ten pakiet nie wymaga nowych bibliotek UI ani kolejnego przeprojektowania całej aplikacji.
