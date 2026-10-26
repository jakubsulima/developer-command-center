# Plan poprawek Startu i rozwoju Wiedzy

Data: 4 października 2026. Status: pięć poprawek pierwszego wydania oraz podpowiedzi Wiedzy, eksport AI, ulubione widoki i postęp czytania zaimplementowane lokalnie. Testy lokalne przeszły; zdalne migracje i pełny odbiór pozostają do wykonania. [Raport realizacji](./2026-10-04-product-improvements-implementation.md) rozdziela kod, testy i wdrożenie.

Plan przekłada audyt aplikacji na kolejność prac, reguły działania, mapę kodu i kryteria odbioru. Pierwsze wydanie obejmuje pięć poprawek istniejącego produktu. Kolejne wydania rozwijają Wiedzę i przekazywanie kontekstu do AI. Ulubione widoki, postęp czytania, offline i powtórki są osobnymi przyrostami, a nie warunkiem ukończenia pierwszego wydania.

Założenie robocze: Command pozostaje osobistym narzędziem do pracy i nauki, używanym na telefonie i komputerze. Najważniejsze są wiarygodne informacje, szybki wybór następnego kroku i powrót do zapisanych materiałów. Nie ma jeszcze decyzji o rozwoju produktu zespołowego ani o pierwszeństwie nauki nad pracą projektową.

## Stan potwierdzony podczas audytu

| Obszar | Potwierdzone zachowanie | Znaczenie dla planu |
| --- | --- | --- |
| Metryki | Start pokazał 0 ukończonych Działań, Podsumowanie 5 dla tygodnia 28 września–4 października. Powrót na Start zachował rozbieżność. | Naprawa poprawności w pierwszej kolejności. Nie zakładamy, że sama zgodność dwóch liczb potwierdza poprawność agregatu. |
| Źródło metryk | `deriveHomeSummary` liczy lokalnie przez `selectWorkspaceActivity`; `deriveWeeklyReview` preferuje pasujący agregat `state.weeklySummary`. | To potwierdzona różnica w kodzie wyjaśniająca obserwację przy niepełnej liście lokalnej. Odbiór musi porównać także rekordy szczegółowe. |
| Rekomendacja | Start oraz sygnał Projektu wybierają blokadę przed planem dnia. Nie wykluczają blokad z przyszłym `reviewOn`. | Wspólna reguła kwalifikowania blokad, z zachowaniem ich widoczności na liście. |
| AI | Start pokazuje oznaczoną jako nieaktualną analizę z 25 września, wraz z długim fragmentem treści. | Uproszczenie prezentacji, z zachowaniem obsługi aktualności i błędów. |
| Plan tygodnia | W liście zaległych Działań widoczne są `ready`, `in_progress` i daty w formacie technicznym. | Wykorzystanie istniejących etykiet i wspólnego formatowania. |
| Czytelnia | Istnieją szablon `reading`, statusy książek, formularze i powiązania. Otwarty Projekt „Wiedza książkowa” pokazał widok standardowy. | Problem odkrywalności szablonu. Nie potwierdzono błędu zapisu szablonu ani uszkodzenia danych tego Projektu. |
| Wiedza | Są filtry, krótkie notatki, relacje, szkice i archiwizacja. Nie znaleziono pełnego przepływu podpowiedzi duplikatów adresów ani ulubionych widoków. | Rozwijać istniejącą Bibliotekę, bez tworzenia drugiego magazynu materiałów. |
| Pozostałe funkcje | Kod i testy obejmują plan tygodnia, datę powrotu do blokady i dodawanie rezultatu do Działania. | Nie realizować ich ponownie jako nowych funkcji. Zapis w aktualnym środowisku nie był sprawdzany w audycie. |
| Weryfikacja | `pnpm typecheck` i `pnpm test` przeszły: 71 plików, 502 testy. | To punkt odniesienia, a nie odbiór planowanych zmian. Nie wykonano pełnego odbioru na dwóch urządzeniach. |

Skrócone ścieżki zaczynające się od `domain/`, `pages/`, `components/`, `app/`, `auth/` i `data/` odnoszą się do `apps/web/src/`. Ścieżka `vite.config.ts` oznacza plik w `apps/web/`; ścieżki `supabase/`, `packages/` i `docs/` odnoszą się do katalogu repozytorium. Nazwy nowych modułów i kontraktów poniżej są propozycjami implementacyjnymi, nie istniejącymi API.

## Kolejność i granice wydań

| Wydanie | Zakres | Warunek rozpoczęcia | Wynik |
| --- | --- | --- | --- |
| Pierwsze | Spójne metryki, rekomendacje Startu, zwięzła stara analiza AI, język planu, odkrywalność Czytelni | Odtworzenie bieżących problemów | Wiarygodny i czytelny codzienny przepływ |
| Drugie | Duplikaty adresów i podpowiedzi istniejącej Wiedzy | Odbiór pierwszego wydania | Materiały można odnaleźć i powiązać w momencie pracy |
| Trzecie | Eksport kontekstu Projektu, Celu i Działania | Ustalone odczyty kompletnych danych; nie wymaga ukończenia podpowiedzi | Gotowy pakiet do skopiowania do zewnętrznego asystenta |
| Następne | Ulubione widoki oraz postęp czytania i powrót do materiału | Wybór ważniejszego zastosowania | Mniej powtarzalnego klikania i łatwiejsze kontynuowanie nauki |
| Warunkowe | Capture offline, udostępnianie do Command, powtórki | Potwierdzenie potrzeby i platformy docelowej | Pełny przepływ wybranej funkcji, bez obowiązku realizacji całego pakietu |

W pierwszym wydaniu metryki i rekomendacje realizować przed odbiorem całości. Zmiany języka i prezentacji mają odrębne kryteria i mogą być dostarczane jako małe zmiany. Nie łączyć wszystkich wydań w jeden PR ani jedną migrację.

## Pierwsze wydanie

### Spójne metryki tygodnia

**Rezultat:** Start, Podsumowanie i lista szczegółów odnoszą się do tego samego tygodnia w strefie Workspace i pokazują zgodną liczbę ukończonych Działań, dodanej Wiedzy oraz aktualizacji postępu.

**Reguły danych:**

- Granice tygodnia są wspólne: początek włącznie, koniec wyłącznie. Nie porównywać tygodnia według strefy przeglądarki z tygodniem Workspace.
- Demo wylicza wynik z kompletnego stanu lokalnego. Supabase korzysta z agregatu obejmującego cały zakres, niezależnie od paginacji i odwiedzonych ekranów.
- Brak pasującego agregatu w Supabase oznacza stan oczekiwania, nieaktualności albo błędu. Nie zastępować go zerem wyliczonym z niepełnej listy.
- Agregat poprzedniego tygodnia nie może być wyświetlany jako bieżący. Starszy agregat bez granic okresu wymaga uzupełnienia przez istniejący odczyt; w razie braku zgodnego odczytu pokazać brak aktualnych metryk.
- Historyczne migawki Podsumowań pozostają niezmienne. Naprawa dotyczy bieżących metryk.

**Kroki implementacji:**

1. Dodać test regresji z pustą lokalną listą ukończonych Działań i agregatem równym 5. Sprawdzić, że oba ekrany wybierają to samo źródło, a nie tylko tę samą wartość w pełnym demo.
2. Wyodrębnić wspólny selektor metryk, np. `domain/weeklyMetrics.ts`, z jawną informacją o dostępności, zakresie i źródle wyniku. Przekazać tryb źródła danych jawnie; nie odgadywać go na podstawie liczby rekordów.
3. Podłączyć `deriveHomeSummary` i `deriveWeeklyReview` do wspólnego kontraktu. Ujednolicić komponenty dla ładowania, nieaktualnego wyniku i ponowienia odczytu.
4. Wykorzystać `get_workspace_weekly_summary`. Zweryfikować dekoder: liczniki są skończonymi nieujemnymi liczbami, okres jest poprawny. W pierwszej kolejności nie zmieniać SQL, jeśli istniejący agregat odpowiada ustalonej semantyce.
5. Po potwierdzonym ukończeniu, cofnięciu, ponownym otwarciu, dodaniu Wiedzy lub postępu odświeżyć metryki. Uwzględnić operacje widoczności wpływające na agregat. Po błędzie zapisu przywrócić poprzedni widok.
6. Zachować koordynację zapisów: starsza odpowiedź odczytu nie może nadpisać stanu po nowszej mutacji. Zgrupować odświeżenia po szybkich kolejnych operacjach, bez pobierania całej historii.
7. Odświeżać okres po powrocie do karty i przy zmianie tygodnia, także gdy aplikacja pozostawała otwarta przez północ. Dołączyć strefę i zakres do klucza odczytu.

**Mapa kodu:** `domain/activity.ts`, `domain/homeSummary.ts`, `domain/weeklyReview.ts`, `domain/types.ts`, `pages/StartPage.tsx`, `pages/ReviewPage.tsx`, `components/AIStartGuidance.tsx`, `app/store.tsx`, `app/workspaceMutationCoordinator.ts`, `data/workspaceRepository.ts`, `data/supabaseWorkspaceRepository.ts`, `data/localWorkspaceRepository.ts`. Źródło SQL: `supabase/migrations/20260908090100_workspace_weekly_summary_timezone.sql`.

**Testy i odbiór:** częściowo wczytane dane; zero rzeczywistych ukończeń; agregat z poprzedniego tygodnia; brak agregatu; niedziela/poniedziałek; zmiana czasu; ukończ → cofnij; nieudany zapis; opóźniona odpowiedź starszego odczytu. Na stagingu utworzyć pięć ukończeń, otworzyć aplikację od Startu i od Podsumowania, porównać wynik ze szczegółami obejmującymi wszystkie strony. Powtórzyć odczyt na drugim urządzeniu.

**Warunek ukończenia:** zgodne i poprawne metryki bez ręcznego reloadu po udanym zapisie; brak fałszywego zera przy błędzie. **Ryzyko:** nadmiar odczytów i migotanie liczb; kontrolować liczbę żądań i zachować poprzedni wynik z etykietą aktualizacji.

### Rekomendacje zgodne z terminem powrotu do blokady

**Rezultat:** blokada odłożona do przyszłego dnia nie zajmuje stale miejsca „Najważniejsze teraz”. Blokady nadal są dostępne w Działaniach i podsumowaniu Projektu.

Proponowana kolejność wyboru jednej rekomendacji:

1. Blokada z `reviewOn` przypadającym dzisiaj albo wcześniej, od najwcześniejszego terminu powrotu.
2. Zaległe niezablokowane Działanie wymagające decyzji, od najstarszego terminu.
3. Wykonalne Działanie na dziś. W tej grupie najpierw jawnie przypięte, następnie należące do priorytetów bieżącego tygodnia; Rutyny pozostają normalnymi Działaniami.
4. Wykonalny następny krok aktywnego Celu, bez przyszłego terminu wykonania; pierwszeństwo mają priorytety bieżącego tygodnia.
5. Blokada bez daty powrotu z propozycją „Ustal, kiedy wrócić do blokady”.
6. Aktywny Cel bez następnego kroku, następnie Skrzynka i spokojny stan pusty.

Priorytety pochodzą z najnowszej zapisanej rewizji planu, którego zakres obejmuje **bieżący tydzień**. Nie brać niezatwierdzonego szkicu ani planu przyszłego tygodnia. Odczyt musi odnaleźć właściwy plan niezależnie od wczytania historii Review. Gdy planu nie ma albo nie można go odczytać, działa stabilna kolejność bez priorytetów. Remisy rozstrzygać po dacie, pozycji i ID, aby karta nie zmieniała się losowo. Jeśli pozostały wyłącznie przyszłe Działania lub blokady, pokazać „Brak pilnego kroku na dziś” i najbliższy termin, zamiast sugerować, że Workspace jest pusty.

**Kroki implementacji:**

1. Rozszerzyć reguły w `domain/blockerReview.ts` o podział na termin powrotu osiągnięty, przyszły i nieustalony. Wykorzystać istniejące `isWaitingAction` tam, gdzie znaczenie jest identyczne.
2. Wyodrębnić wspólne kwalifikowanie kandydatów dla `homeSummary.ts` i `projectModule.ts`. Projekt ogranicza kandydatów do własnego kontekstu; globalny wybór korzysta z tego samego znaczenia dat.
3. Dodać odczyt bieżącego planu i selektor jego priorytetów. Współdzielić go z porównaniem planu i wykonania w Review; nie kopiować całej historii do Startu.
4. Oddzielić „wymaga uwagi teraz” od „wszystkie blokady”. Przyszła blokada pozostaje w drugim zbiorze, z etykietą daty; nie usuwać jej z danych ani nie zmieniać statusu.
5. Wykluczyć z rekomendacji wykonania Działania zablokowane, zakończone i ukryte. Ujednolicić opis powodu wyboru oraz link do właściwego Działania lub kolejki.

**Mapa kodu:** `domain/blockerReview.ts`, `domain/homeSummary.ts`, `domain/projectModule.ts`, `domain/weeklyPlan.ts`, `domain/actionsList.ts`, `pages/StartPage.tsx`, `pages/ProjectsPage.tsx`, `pages/ProjectDetailPage.tsx`, `pages/ReviewPage.tsx`, repozytoria odczytu.

**Testy i odbiór:** przyszła blokada + zadanie na dziś; blokada dzisiejsza + zaległe; brak daty blokady + wykonalny krok; tylko przyszłe blokady; ukryty Cel; plan przyszłego tygodnia; kilka rewizji bieżącego planu; brak planu; granica daty w strefie Workspace. Na telefonie sprawdzić uzasadnienie rekomendacji i docelowy ekran po kliknięciu.

**Warunek ukończenia:** odłożenie blokady usuwa ją z pilnej rekomendacji do właściwego dnia, lecz nie z listy blokad. **Ryzyko:** zmiana przyzwyczajeń; zachować widoczne wyjaśnienie wyboru i dostęp do pełnej listy. Reguły kolejności są propozycją produktową tego planu, nie stwierdzeniem o aktualnej implementacji.

### Zwięzły stan nieaktualnej analizy AI

**Rezultat:** stara analiza pozostaje dostępna, ale nie zajmuje głównej części Startu i nie wygląda jak bieżąca rekomendacja.

1. W stanie nieaktualnym pokazać „Analiza z 25 września jest nieaktualna”, krótki powód oraz akcje „Odśwież” i „Zobacz poprzednią analizę”. Format daty korzysta ze strefy Workspace.
2. Usunąć automatyczny długi fragment starego podsumowania z tego stanu. Link prowadzi do istniejącej zakładki AI; szczegóły techniczne czasu sprawdzenia mogą być rozwijane.
3. Zachować odrębność stanów: brak analizy, aktualna, dane zmienione, wygasła, zmienione ustawienia, nie można sprawdzić aktualności, generowanie i błąd generowania.
4. „Odśwież” zachowuje istniejący przepływ zgody, cache, błędów i limitów. Samo wejście na Start ani rozwinięcie informacji nie wywołuje modelu. Podczas generowania zablokować powtórne uruchomienie; po błędzie stara analiza nadal dostępna.

**Mapa kodu:** `components/AIStartGuidance.tsx`, `domain/aiStartGuidance.ts`, `components/AIGoalReviewShared.tsx`, istniejące style Startu. Nie zmieniać promptów, dostawcy AI ani kontraktu generowania.

**Odbiór:** istniejące testy stanów AI pozostają zielone; test zachowania potwierdza brak generowania przy odczycie starej analizy. Na szerokości 360 i 390 px treść nie zasłania planu dnia, przyciski nie nachodzą na siebie. **Ryzyko:** zbyt mało kontekstu; pełna analiza musi być dostępna jednym przejściem.

### Czytelne etykiety planu tygodnia

**Rezultat:** użytkownik widzi „Do zrobienia”, „W toku” i „2 paź”, zamiast wartości technicznych.

1. W `WeeklyPlanPanel.tsx` zastąpić bezpośredni odczyt `action.status` wspólną etykietą z `domain/labels.ts` lub istniejącą prezentacją Działania.
2. Ujednolicić daty w zaległościach, podglądzie zmiany i opisie obecnego terminu. Dla dat kalendarzowych unikać przesunięcia o dzień przez konwersję strefy; przy innym roku wyświetlać również rok.
3. Zachować rozróżnienie terminu wykonania i daty powrotu do blokady. Format danych formularza oraz wartości przekazywane do backendu pozostają zgodne z kontraktem.
4. Sprawdzić dostępne nazwy checkboxów i opis podglądu przed zapisem. Używać tego samego języka dla wzroku i czytnika ekranu.

**Mapa kodu:** `components/WeeklyPlanPanel.tsx`, `domain/labels.ts`, `domain/actionPresentation.ts`, `domain/activity.ts`.

**Odbiór:** lista zaległych, zaznaczenie i podgląd zmiany są czytelne na mobile; istniejące testy planowania, częściowego błędu i cofania przechodzą. Nie tworzyć osobnej rozbudowanej suity dla samej podmiany etykiet. **Ryzyko:** błędna konwersja daty; wykorzystać istniejący formatter lub jeden wspólny helper.

### Dostępny wybór Czytelni

**Rezultat:** użytkownik rozumie, jaki szablon ma Projekt, i może łatwo wybrać Czytelnię dla istniejącego zbioru książek.

1. W nagłówku szczegółu Projektu pokazać bieżący szablon: „Standardowy” albo „Czytelnia”, z akcją otwierającą istniejącą edycję szablonu.
2. Użyć `ProjectPresetPicker`; zmiana wymaga zwykłego zapisu formularza. Nie odgadywać szablonu z nazwy Projektu i nie zmieniać go automatycznie po zmianie kategorii.
3. Po zapisaniu `reading` domyślnym wejściem jest Wiedza, a główną akcją „Dodaj książkę”. Świadomy link do innej zakładki nadal działa.
4. W pustej Czytelni udostępnić „Dodaj pierwszą książkę” oraz istniejące „Połącz książkę z Biblioteki”. Nie wymagać Celu przed dodaniem materiału.
5. Po przejściu do szablonu standardowego zachować książki, notatki, relacje i statusy. Zmienia się prezentacja, nie własność ani model danych.

**Mapa kodu:** `domain/projectPresets.ts`, `domain/projectModule.ts`, `components/ProjectPresetPicker.tsx`, `pages/ProjectDetailPage.tsx`, ewentualnie etykieta na `pages/ProjectsPage.tsx`. Wykorzystać istniejące pole `areas.preset` i istniejący zapis.

**Testy i odbiór:** nowy pusty Projekt; istniejący Projekt z Celami i Wiedzą; zmiana w obie strony; błąd zapisu; odświeżenie strony; zachowanie linku do zakładki. **Ryzyko:** uznanie zmiany wyglądu za migrację danych; opis formularza powinien jasno mówić, że dane pozostają.

## Drugie wydanie z podpowiedziami Wiedzy

### Rozpoznawanie wcześniej zapisanego linku

**Przepływ:** po wpisaniu poprawnego adresu użytkownik otrzymuje krótką podpowiedź „Ten materiał jest już w Bibliotece”. Może otworzyć materiał, powiązać go z bieżącym kontekstem albo świadomie zapisać nowy wpis.

1. Dodać niezależną funkcję porównywania adresów. Istniejące `normalizeHttpUrl` waliduje adres, ale nie realizuje deduplikacji. Nowy klucz porównania normalizuje host i domyślny port; zachowuje schemat, ścieżkę, parametry, ich znaczącą kolejność i fragment. Nie pobiera strony ani przekierowań.
2. W repozytorium dodać ograniczone zapytanie aktywnych Materiałów po kluczu adresu. Wynik musi obejmować cały Workspace, nie tylko wczytaną stronę. Zwracać najwyżej pięć wyników i informację o kolejnych, jeśli istnieją.
3. Jeżeli potrzebne jest indeksowane pole, dodać migrację z obliczeniem wartości dla obecnych wpisów. Klucz nie ma ograniczenia unikalności: użytkownik nadal może zapisać dwa materiały z tym samym adresem. Zachować zgodność starego klienta zapisującego sam URL, np. przez wyliczenie klucza po stronie bazy.
4. Podłączyć wspólną podpowiedź do tworzenia Materiału w Bibliotece, Projekcie i przetwarzaniu Skrzynki. Zwykły capture nadal zachowuje oryginalną treść i nie musi być przerywany obowiązkową decyzją.
5. Powiązanie istniejącego materiału w triage zachowuje kopertę Skrzynki i wskazuje rezultat przetworzenia. Zapis relacji jest idempotentny; ponowienie nie dubluje powiązania. „Otwórz” nie oznacza przetworzenia wpisu.
6. Błąd wyszukania duplikatu nie blokuje zapisu. Nieaktualna odpowiedź na poprzedni adres nie zastępuje podpowiedzi dla nowego.

**Mapa kodu:** `domain/http-url.ts`, `domain/knowledge.ts`, `data/workspaceRepository.ts`, oba repozytoria, `domain/commands.ts`, `pages/KnowledgePage.tsx`, `pages/ProjectDetailPage.tsx`, `pages/InboxPage.tsx`, `components/CaptureComposer.tsx`; nowy współdzielony komponent sugestii.

**Odbiór:** ten sam adres na dalszej stronie; różne query i fragmenty; brak sugestii z obcego Workspace, Kosza i Archiwum; błąd sieci; ponowione połączenie; świadomy zapis osobnego wpisu. Backend i demo mają te same reguły. **Ryzyko:** fałszywe podobieństwa; stosować ostrożne porównanie i brak automatycznego scalania.

### Materiały przydatne przy Celu i Działaniu

Pokazać najwyżej trzy jeszcze niepowiązane aktywne materiały z tego samego Projektu, z opisem „Z tego samego Projektu”. Ranking jest deterministyczny: zgodność kontekstu, aktualność, ID. Jest to propozycja kontekstowa, nie deklaracja semantycznej trafności.

Wykorzystać zapytania i komponent sugestii z poprzedniego kroku. „Powiąż” używa istniejących znaczeń relacji i oferuje cofnięcie; „Otwórz” zachowuje powrót do źródłowego Celu lub Działania. Nie proponować już powiązanego materiału ani rekurencyjnie całego grafu Wiedzy.

**Mapa kodu:** `components/ActionKnowledgeRelations.tsx`, `pages/ActionDetailPage.tsx`, `pages/GoalDetailPage.tsx`, `domain/projectModule.ts`, `domain/knowledgeFilters.ts`, repozytoria.

**Odbiór:** materiał niezaładowany wcześniej jest znajdowany; po powiązaniu znika z sugestii i pojawia się w relacjach; cofnięcie przywraca stan; pusty wynik nie tworzy dużego pustego panelu. **Ryzyko:** szum na szczególe; utrzymać limit i kompaktową prezentację.

## Trzecie wydanie z eksportem kontekstu do AI

Rozwinąć istniejący [plan kontekstu dla AI](./2026-09-14-ai-context-implementation.md). Pierwsze dostarczane wydanie kończy się pakietem Markdown/JSON do skopiowania lub pobrania. MCP jest późniejszym, oddzielnym wydaniem z tamtego planu.

1. Dodać akcję „Przekaż kontekst do AI” w Projekcie, Celu i Działaniu. Panel zawiera intencję użytkownika, wybór źródeł i podgląd finalnej treści.
2. Zachować kontrakt `ContextRequest` i `ContextBundle` z wcześniejszego planu: wersja formatu, źródła, daty, pominięcia i informacja o kompletności. Odczyt pobiera rzeczywiste dane z repozytorium; nie zależy od wcześniejszej nawigacji.
3. Dla Projektu uwzględniać opis, do 20 aktywnych Celów i do 20 otwartych Działań; dla Celu kryteria i kroki; dla Działania jego treść, blocker, checklistę oraz nadrzędny kontekst. Dołączyć do 5 aktualizacji postępu i do 10 wybranych elementów Wiedzy, z deduplikacją.
4. Stosować limity wcześniejszego planu: 40 000 znaków treści, 2 000 znaków intencji, maksymalnie 256 KiB po serializacji. Każde ograniczenie jest widoczne; nie nazywać obciętego pakietu kompletnym.
5. Archiwum, Kosz, surowa Skrzynka i historyczny Focus są domyślnie pominięte. Panel nie wywołuje modelu i nie przesyła pakietu do dostawcy AI. Skopiowanie następuje po jawnej akcji użytkownika.
6. Obsłużyć brak schowka przez pobranie pliku lub ręczne zaznaczenie. Jeśli odczyt wymaganego źródła się nie udał, pokazać błąd i retry; częściowy pakiet wymaga wyraźnego oznaczenia.
7. Zachować wcześniejszy zamiar współdzielonego kontraktu dla przyszłego MCP. Najpierw sprawdzić zgodność importów pakietu `packages/ai-context` z Vite; nie tworzyć jeszcze serwera MCP ani nowego czatu w produkcie.

**Mapa kodu:** repozytoria, `domain/actionContext.ts`, `domain/knowledge.ts`, strony szczegółów; nowe typy i renderer kontekstu oraz panel eksportu. Nie stosować specjalistycznego kontekstu przeglądu Celów jako zamiennika pełnego pakietu.

**Odbiór:** bezpośredni link do obiektu po nowym logowaniu daje ten sam zestaw źródeł co po odwiedzeniu list; duża Biblioteka, brak źródła, nieaktualna wersja, przekroczenie limitu i obcy Workspace mają jawny wynik. Skopiowany tekst odpowiada podglądowi. **Ryzyko:** nadmierny zakres eksportu; domyślna selekcja musi być ograniczona i edytowalna.

## Kolejne funkcjonalności

### Ulubione widoki Działań

**Zakres pierwszej wersji:** do pięciu nazwanych widoków Działań na użytkownika i Workspace. Rozszerzenie na Wiedzę dopiero po użyciu tej wersji.

1. Ustalić listę dozwolonych parametrów na podstawie parsera filtrów w `ActionsPage.tsx` i `domain/actionsList.ts`. Zapisywać znaczenie „dzisiaj”, nie datę utworzenia widoku. Pominąć kursor, podświetlenie rekordu, pozycję scrolla i jednorazowe parametry otwarcia formularza.
2. Proponowany rekord: ID, użytkownik, Workspace, nazwa, wersja formatu filtrów, filtry, pozycja, wersja rekordu i daty. Wprowadzić addytywną tabelę, RLS, walidację i atomowy limit pięciu rekordów. Nie przechowywać kopii Działań.
3. Dodać „Zapisz widok”, wybór, zmianę nazwy i usunięcie z cofnięciem. Zmiana filtrów nie nadpisuje ulubionego automatycznie.
4. Zarchiwizowany lub niedostępny Projekt/Cel wyświetla informację o nieaktualnym filtrze i możliwość edycji. Nie rozszerzać po cichu widoku na wszystkie dane.
5. Zapis uwzględnić w eksporcie i adapterze demo; po logowaniu na drugim urządzeniu dostępne są te same widoki tego użytkownika.

**Odbiór:** zapis i odtworzenie filtrów, Wstecz/Dalej, dynamiczne „dzisiaj”, dwa równoczesne zapisy przy limicie, konflikt edycji, niedostępny Cel i izolacja użytkowników. **Ryzyko:** przeciążenie nawigacji; osobne niewielkie menu z limitem.

### Postęp czytania i powrót do materiału

Podzielić na dwa małe przyrosty. Pierwszy dodaje datę powrotu do aktywnego Materiału lub Notatki. Drugi dodaje pozycję czytania dla książki.

**Data powrotu:** opcjonalne `revisitOn`, rozumiane jako data kalendarzowa w Workspace. Widok „Do powrotu” obejmuje daty dzisiejsze i zaległe, sortuje stabilnie i pozwala przełożyć albo wyczyścić datę. Samo otwarcie nie czyści terminu. Start pokazuje kompaktowy link z liczbą, bez wypierania Działań. Archiwum i Kosz nie pojawiają się w tej kolejce; przywrócenie zachowuje datę.

**Postęp książki:** opcjonalna bieżąca strona, liczba stron i krótki opis pozycji, np. rozdział. Strony są nieujemnymi liczbami całkowitymi; podana całkowita liczba stron jest dodatnia i nie mniejsza od bieżącej. Wartości „nie podano” i „0” są różne. Procent pojawia się tylko przy znanej liczbie stron. Sam postęp nie zamyka Celu ani nie zmienia automatycznie statusu książki na „Przeczytana”.

Wniosek zapisuje się przez istniejącą Notatkę z relacją `source`, bez drugiego pola przechowującego tę samą treść. Książka pozostaje jednym obiektem, więc jej pozycja i status są wspólne we wszystkich Projektach.

**Warstwy:** addytywne pola w danych Wiedzy, komendy z kontrolą wersji, walidacja demo/Supabase, eksport, filtrowane zapytanie przed paginacją i odpowiedni indeks. UI: `KnowledgeDetailPage.tsx`, `KnowledgePage.tsx`, Czytelnia w `ProjectDetailPage.tsx`, mały sygnał Startu.

**Odbiór:** dwa Projekty z tą samą książką, odłożenie daty, archiwizacja/przywrócenie, cofnięcie błędnego zapisu, konflikt dwóch urządzeń, brak liczby stron, starszy rekord bez nowych pól. **Ryzyko:** obowiązek raportowania; wszystkie pola opcjonalne, zapis pozycji krótki i niezależny od notatki.

### Capture offline

Rozwinąć [istniejący plan offline](./plan-04-offline-capture.md). Zakres pozostaje ograniczony do nowych tekstów i linków w Skrzynce.

1. Wprowadzić kolejkę IndexedDB z `commandId`, właścicielem, Workspace, treścią, czasem, stanem, liczbą prób i ostatnim błędem. Zapis lokalny musi się udać przed pokazaniem potwierdzenia i wyczyszczeniem formularza.
2. Zapewnić uruchomienie ograniczonego formularza capture bez połączenia w wcześniej uruchomionej PWA. Sprawdzić bramkę Auth i ładowanie Workspace; cache plików aplikacji sam tego nie zapewnia. Brak wcześniejszego rozpoznania użytkownika i Workspace nie daje obietnicy zapisu do konkretnego konta.
3. Wysyłać po odzyskaniu sieci, otwarciu aplikacji i ręcznym retry. Przed wysyłką sprawdzać sesję oraz zgodność właściciela i Workspace. Nie obiecywać pracy w tle przy zamkniętej aplikacji.
4. Utrzymywać ten sam klucz idempotencji po timeoutach i reloadzie. Po potwierdzeniu serwera usunąć wpis lokalny; awaria między zapisem zdalnym a lokalnym potwierdzeniem nie tworzy drugiego capture.
5. Rozróżnić oczekiwanie, wysyłanie, brak logowania i błąd. Stosować ograniczone ponowienia z odstępem; błędów walidacji nie ponawiać bez końca. Synchronizacja wielu kart nie może duplikować skutków.
6. Obsłużyć wylogowanie z niewysłanymi wpisami przez jawny wybór: wróć i zsynchronizuj, skopiuj/wyeksportuj treść lub świadomie odrzuć lokalne wpisy. Nie czyścić ich po cichu. Wygaśnięcie sesji zatrzymuje wysyłkę i wymaga ponownego logowania właściwego użytkownika.
7. Uwzględnić odmowę dostępu do pamięci i brak miejsca. Pokazać, że zapis się nie udał, oraz możliwość skopiowania treści. Lokalna pamięć nie jest gwarantowanym trwałym backupem.

**Mapa kodu:** `components/CaptureComposer.tsx`, `app/store.tsx`, `auth/AuthRoot.tsx`, `auth/private-browser-state.ts`, nowe repozytorium kolejki, `vite.config.ts`, komenda tworzenia Skrzynki i testy idempotencji.

**Odbiór:** produkcyjny build PWA: online → offline → capture → zamknięcie → otwarcie → online; dokładnie jeden rekord na serwerze. Dodatkowo timeout po zatwierdzonym zapisie, dwie karty, wygaśnięta sesja, zmiana konta i pełna pamięć. **Ryzyko:** to największy przyrost operacyjny tego planu; realizować po potwierdzeniu potrzeby mobilnego capture.

### Udostępnianie do Command

Opcjonalne rozszerzenie capture. Przed implementacją wskazać docelowy system i przeglądarkę oraz sprawdzić rzeczywistą obsługę [Share Target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target) na urządzeniu użytkownika.

Przy obsługiwanej platformie dodać wpis manifestu i odbiornik tekstu/linku, pokazujący podgląd przed zapisem do Skrzynki. Przechować wejściową treść podczas logowania; po zapisie używać tych samych reguł deduplikacji żądań i, jeśli wdrożona, kolejki offline. Nie pobierać automatycznie treści stron. Obsługę plików odłożyć. Przy braku wsparcia zapewnić wygodne wklejenie linku zamiast pozornej integracji.

**Odbiór:** udostępnienie z rzeczywistej aplikacji źródłowej, brak sesji, podwójne otwarcie, niepoprawny adres, powrót po anulowaniu. **Ryzyko:** różnice platform; działanie w desktopowym emulatorze nie zamyka odbioru.

### Krótkie powtórki nauki

Realizować po potwierdzeniu, że użytkownik chce regularnie wykonywać próby w Command. Najpierw sprawdzić na kilku rzeczywistych materiałach, czy prosty powrót do notatki wystarcza.

**Przepływ:** z Materiału lub Notatki utwórz pytanie albo zadanie, opcjonalnie powiąż Cel; zobacz pytanie; odpowiedz; porównaj z własną odpowiedzią referencyjną; zapisz samoocenę „Nie pamiętam”, „Częściowo”, „Pamiętam” i termin kolejnej próby.

**Dane:** osobny rekord pytania i niezmienne rekordy prób. Próba zachowuje wersję lub migawkę pytania, odpowiedź, samoocenę i czas; późniejsza edycja pytania nie przepisuje historii. Termin kolejnej próby należy do harmonogramu pytania. Nowe tabele wymagają RLS, eksportu, adaptera demo i idempotentnego zapisu próby wraz z terminem.

**UI i granice:** kolejka „Do powtórki”, odłożenie, archiwizacja pytania, przejście do źródła. Samo odłożenie nie tworzy udanej próby; powtórka nie oznacza osiągnięcia Celu. Pierwsza wersja nie generuje pytań modelem, nie ocenia odpowiedzi AI i nie wprowadza złożonego algorytmu interwałów.

**Odbiór:** ponowiony zapis daje jedną próbę; nowa próba dodaje historię; edycja pytania zachowuje starszą wersję; niedostępne źródło ma czytelny stan; obcy Workspace jest odrzucony. **Ryzyko:** zbyt szeroki produkt; mierzyć faktyczne powroty użytkownika przed rozbudową.

## Wspólne zasady implementacji i odbioru

### Zapis i kompatybilność

Każdy przyrost obejmujący dane dostarcza zgodne demo i Supabase, odczyt po ponownym logowaniu, eksport, kontrolę wersji oraz izolację Workspace. Repozytoria pobierają dane przed filtrowaniem i paginacją zgodnie z kontraktem; komponenty nie uznają lokalnie wczytanych rekordów za kompletną bazę.

Nowe migracje są addytywne i tworzone zgodnie z procedurą projektu. Dla nowych tabel i RPC wymagane są jawne granty, RLS, walidacja powiązań i test odrzucenia obcego Workspace. Starszy frontend musi działać po migracji, a nowy pokazywać czytelny brak obsługi przy starszym backendzie. Nie edytować zastosowanych migracji ani usuwać starych pól w tym samym wydaniu.

Planowanie nie wdraża migracji. Podczas realizacji używać lokalnych/izolowanych testów, a staging i produkcję wdrażać zgodnie z zakresem autoryzowanego zlecenia oraz instrukcją `docs/deployment/managed-supabase.md`.

### Kontrole jakości

Po każdym ukończonym wydaniu wykonać kontrole wymagane przez repozytorium:

```bash
pnpm lint
pnpm typecheck
pnpm test
VITE_DATA_BACKEND=demo pnpm build
```

CI wykonuje dodatkowo coverage oraz raporty wydajności. Nie deklarować przejścia CI na podstawie samego lokalnego uruchomienia. Testy nowych reguł mają sprawdzać zachowanie i granice, a nie kopiować implementację. Same zmiany etykiet i układu weryfikować przez istniejące testy i odbiór UI.

| Próba odbioru | Pierwsze wydanie | Funkcje z nowymi danymi |
| --- | --- | --- |
| Desktop i telefon | Start, Plan, szczegół Projektu; szerokości 360, 390, 768 i 1440 px | Cały nowy przepływ z formularzem i klawiaturą ekranową |
| Klawiatura | Kolejność fokusu, Enter, Escape, powrót z panelu | Dodatkowo wybór sugestii i stany zapisu |
| Błędy | Brak aktualnych metryk, błąd AI i zapisu szablonu | Retry, konflikt wersji, brak uprawnień i brak danych |
| Dwa urządzenia | Metryki i szablon po odświeżeniu/wznowieniu | Nowe preferencje, relacje i pozycja czytania |
| Duży zbiór | Metryki niezależne od paginacji | Materiały i sugestie spoza pierwszej strony |
| Cofnięcie | Ukończ → cofnij, bez utraty następnego kroku | Relacje i operacje odwracalne zgodnie z ich kontraktem |

Staging korzysta z odseparowanego Workspace z danymi testowymi. Nie wykonywać testów mutujących na osobistych danych z audytu. Odbiór telefonu obejmuje prawdziwe urządzenie dla klawiatury, offline i udostępniania; zmiana szerokości przeglądarki nie zastępuje tych prób.

### Obserwacja działania i wycofanie

Wykorzystać istniejące `AppErrorReporter` i pomiary czasu. Rejestrować kategorie błędów oraz czas odczytu/zapisu, bez pełnej treści notatek, pakietów AI i adresów źródeł. Dla metryk sprawdzić zgodność z rekordami szczegółowymi oraz brak lawiny odczytów; dla sugestii i eksportu czas dostępu na większym zbiorze.

Każde wydanie ma osobny punkt wycofania frontendu. Przy nowych polach wyłączenie funkcji pozostawia dane; migracje addytywne nie wymagają destrukcyjnego rollbacku. Kolejki offline nie usuwać przy wycofaniu UI: najpierw zapewnić możliwość dokończenia wysyłki lub odzyskania treści. Instrukcja projektu: `docs/deployment/rollback.md`.

## Dokumentacja i rozliczenie wcześniejszych planów

- Ten plan jest punktem wejścia dla prac wynikających z audytu 4 października. Starsze plany zachowują szczegóły zgodne z bieżącą domeną.
- Po implementacji aktualizować status na podstawie dowodów: „lokalnie zaimplementowane”, „testy lokalne przeszły”, „odebrane na stagingu”, „wdrożone”. Nie traktować tych stanów jako zamienników.
- W `docs/planning/README.md` uzupełnić odnośnik do tego planu. Przy zamykaniu poszczególnych etapów skorygować nieaktualne opisy planu tygodnia, krótkich notatek i poprawionego UI.
- W [planie funkcjonalnym z 23 września](./2026-09-23-functional-improvements-plan.md) plan tygodnia i powrót do blokady mają już implementację; podpowiedzi Wiedzy, ulubione widoki i powtórki pozostają osobnymi zakresami. Nie oznaczać całego dokumentu jako ukończonego.
- [Plan Czytelni](./2026-09-26-project-presets-and-reading-library.md) pozostaje źródłem modelu książek. Nowe pola postępu rozszerzają ten model, a nie tworzą drugiego rodzaju książki.
- [Plan kontekstu AI](./2026-09-14-ai-context-implementation.md) i [plan offline](./plan-04-offline-capture.md) zachowują szczegółowe założenia; zakres pierwszych wydań doprecyzowano powyżej.

## Decyzje potrzebne przed opcjonalnymi wydaniami

Pierwsze wydanie można rozpocząć według tego planu po zleceniu implementacji. Nie wymaga wyboru między nauką a pracą projektową. Proponowana kolejność rekomendacji jest opisana jawnie i może zostać skorygowana na etapie odbioru.

Przed wyborem następnego większego przyrostu ustalić:

1. Czy po podpowiedziach Wiedzy i eksporcie AI ważniejsza jest wygoda pracy nad Projektami, czy kontynuowanie książek i kursów? Pierwsza odpowiedź podnosi priorytet ulubionych widoków, druga postępu czytania.
2. Czy potrzebny jest zapis bez internetu i na jakim telefonie/przeglądarce? To wyznacza zakres realnego odbioru offline i Share Target.
3. Czy użytkownik chce wykonywać i oceniać próby nauki w Command? Bez tego powtórki pozostają odłożone, a prostszy powrót do materiału może wystarczyć.

## Polecenie rozpoczynające implementację

> Zrealizuj pierwsze wydanie z `docs/planning/2026-10-04-product-improvements-plan.md`: spójne metryki tygodnia, rekomendacje respektujące termin powrotu do blokady, kompaktowy stan starej analizy AI, czytelne etykiety planu i dostępny wybór Czytelni. Najpierw odtwórz rozbieżność metryk testem z niepełnymi danymi lokalnymi. Zachowaj dotychczasowe dane i wspólną semantykę demo/Supabase. Zakończ wymaganymi kontrolami jakości, odbiorem UI oraz raportem faktycznie wykonanych i niewykonanych prób. Nowe funkcje z kolejnych wydań pozostaw poza zakresem tego zlecenia.
