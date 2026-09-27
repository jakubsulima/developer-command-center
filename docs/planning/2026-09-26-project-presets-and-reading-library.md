# Szablony Projektów i Czytelnia — plan wdrożenia

Data: 26 września 2026. Aktualizacja: 27 września 2026.
Status: etapy 1–5 zaimplementowane lokalnie. Migracje pierwszego wydania i
poprawka `search_path` wdrożone do podłączonego Supabase 27 września 2026;
historia i schemat RPC zweryfikowane. Zdalny odczyt listy Wiedzy działa w
przeglądarce. Nie wykonywano zdalnych zapisów testowych na danych użytkownika.
Etap 6 nierozpoczęty.

## Poprawki po review

- RPC tworzące Cel i Działanie otrzymują identyfikatory relacji klienta, więc
  odłączenie działa również przed ponownym pobraniem danych. Test SQL obejmuje
  zapis, ponowienie komendy i usunięcie obu relacji według tych identyfikatorów.
- Zmiana formatu książka → Materiał → książka zachowuje autora i status czytania.
  Filtry czytania nadal obejmują wyłącznie rekordy oznaczone jako książki.
- Szczegół notatki pobiera źródło także spoza początkowej strony Wiedzy;
  nieudany odczyt ma komunikat i ponowienie. Odświeżanie obejmuje nowe cache relacji
  i półek Projektów.
- Mobilne dodawanie w globalnej Wiedzy otwiera pełny formularz z polami książki
  oraz wyborem źródłowej książki dla notatki.
- Zwykły odczyt Wiedzy pomija nowe argumenty RPC, dzięki czemu aplikacja ładuje
  się również przed migracją. Nowe filtry nadal wymagają migracji i sygnalizują
  jej brak; nie udajemy obsługi funkcji przez starszy backend.

Weryfikacja: 454 testy w 64 plikach, lint, typecheck i build zakończone sukcesem.
W przeglądarce sprawdzono ponowne otwarcie Startu i Wiedzy oraz formularz mobilny
z autorem i statusem książki. Nie zapisywano testowych książek do danych użytkownika.
Migracja pozostaje przygotowana lokalnie, bez wdrożenia zdalnego; pełny przepływ
zapisu na podłączonym Supabase wymaga odbioru po jej zastosowaniu.

## Cel i przyjęty zakres

Umożliwić zbieranie książek, oznaczanie aktualnie czytanych pozycji i zapisywanie
wyniesionej wiedzy bez zamieniania całej biblioteki w listę zobowiązań.
Wykorzystać wspólne Projekty, Cele, Działania i Wiedzę; różnicować prezentację
oraz niewielkie rozszerzenia danych, zamiast budować osobne aplikacje.

Założenia do wykonania tego planu:

- Pierwsze wydanie obejmuje szablony Standardowy i Czytelnia.
- Czytelnia jest szablonem dowolnego Projektu. Można mieć kilka czytelni
  tematycznych; nie tworzymy obowiązkowego, systemowego Projektu.
- Wszystkie książki można znaleźć również w globalnej Wiedzy.
- Książka to odmiana Materiału, nie osobny Projekt ani automatyczny Cel.
- Status czytania wchodzi do pierwszego wydania. Licznik stron i okładki są
  rozszerzeniem po odbiorze podstawowego przepływu.
- Kategorie pozostają wielokrotnego wyboru. Każdy Projekt ma jeden szablon.
- Nie zmieniamy globalnej nazwy modułu Projekty ani nazw Cele i Działania.

## Podstawa w obecnej implementacji

| Obszar | Stan sprawdzony w kodzie | Konsekwencja |
| --- | --- | --- |
| Projekt | `Area` przechowuje trwałą tożsamość; `projectProjection` zbiera powiązane obiekty | Rozszerzamy istniejący Projekt |
| Kategorie | Mają identyfikator, nazwę i kolor; Projekt przechowuje wiele identyfikatorów kategorii | Szablon nie może wynikać z pierwszej kategorii w tablicy |
| Widok Projektu | Przegląd, Cele, Działania i Wiedza; wspólna funkcja sygnałów | Zachowujemy nawigację i mechanikę pracy |
| Pusty Projekt | Podpowiedź ustalenia pierwszego Celu | Czytelnia potrzebuje innego stanu pustego |
| Wiedza | Materiały, notatki, decyzje i rezultaty; relacje z Projektami, Celami, Działaniami, seriami i inną Wiedzą | Wspólna tożsamość książki i notatek |
| Relacje Wiedzy | Model obsługuje Wiedza–Wiedza, UI akcentuje potwierdzenia Decyzji | Potrzebna zwykła relacja źródła i jej obsługa w szczególe |
| Kontekst Projektu | Wyliczany z bezpośrednich relacji oraz Celów, Działań i serii; bez rekurencji przez Wiedzę | Notatka potrzebuje jawnego kontekstu, jeśli ma wystąpić w Projekcie |
| Start i przegląd tygodnia | Wykorzystują konkretne Działania oraz aktywne Cele | Kolejka książek nie tworzy automatycznie sygnałów zaległości |

Źródła: `CONTEXT.md`, `apps/web/src/domain/types.ts`, `projectModule.ts`,
`knowledge.ts`, `weeklyReview.ts`, `homeSummary.ts`, `quickAdd.ts`, strony
Projektów, Wiedzy, Celu i Działania. Szczegóły starszych planów traktować jako
historyczne, jeśli przeczą bieżącemu kodowi lub aktualnej części `CONTEXT.md`.

## Reguły produktu

### Kategoria i szablon

- Kategoria może mieć opcjonalny domyślny szablon.
- Formularz nowego Projektu proponuje go, jeśli zaznaczone kategorie wskazują
  jeden zgodny szablon. Przy konflikcie pokazuje jawny wybór, domyślnie Standardowy.
- Ręczny wybór użytkownika ma pierwszeństwo przed kolejnymi zmianami kategorii.
- Przy zapisie szablon jest zapisywany na Projekcie. Nie dziedziczy się dynamicznie.
- Edycja/usunięcie kategorii ani przeniesienie Projektu nie zmienia szablonu.
- Zmiana szablonu zmienia prezentację; zachowuje książki, notatki i relacje.
- Istniejące Projekty dostają Standardowy. Nie rozpoznajemy szablonu po nazwie
  kategorii i nie konwertujemy automatycznie dotychczasowych danych.
- Nie dziedziczymy szablonu po Projekcie nadrzędnym w pierwszym wydaniu.

### Książka i czytanie

- Statusy: Do przeczytania, Czytam, Przeczytana, Wstrzymana, Porzucona.
- Nowa książka domyślnie ma status Do przeczytania. Autor jest opcjonalny.
- Status należy do książki w Workspace: ta sama książka w dwóch Projektach
  pokazuje ten sam stan czytania. Osobne przebiegi ponownej lektury są poza MVP.
- Przeczytana i Porzucona nie oznaczają Archiwum ani Kosza.
- Status można zmienić bez tworzenia Działania lub Celu.
- Nie generujemy Celów, Działań, terminów ani cyklicznych przypomnień przy dodaniu.
- Nie zamieniamy wszystkich Działań na „rozdziały”. Przeczytanie rozdziału,
  napisanie notatki i zastosowanie pomysłu pozostają konkretnymi Działaniami.
- Nie utożsamiamy przeczytania książki z osiągnięciem Celu nauki.

### Notatki i kontekst

- Notatka powstaje jako zwykła Wiedza; książka jest jej źródłem.
- „Dodaj notatkę” z książki w Projekcie zapisuje w jednej operacji notatkę,
  relację do książki i bezpośrednią relację do bieżącego Projektu.
- Z globalnej Wiedzy nie przypisujemy automatycznie notatki do wszystkich
  Projektów książki. Pokazujemy opcjonalny wybór kontekstu.
- Notatkę można połączyć również z innym Projektem, Celem lub Działaniem.
- Archiwizacja książki nie archiwizuje jej notatek; odłączenie książki od Projektu
  nie usuwa jawnie zapisanych relacji notatek do tego Projektu.
- Materiał w Koszu pozostaje oznaczonym źródłem istniejącej notatki; nie oferujemy
  go jako celu nowych powiązań. Zachowujemy dotychczasowe zasady odzyskiwania.
- Nie propagujemy kontekstu rekurencyjnie przez cały graf Wiedzy.

## Docelowy przepływ

1. Użytkownik tworzy Projekt „Czytelnia”, wybiera kategorię i szablon Czytelnia.
2. „Dodaj książkę” wymaga jedynie tytułu. Książka trafia do kolejki oraz Wiedzy.
3. Użytkownik zmienia status na Czytam. Nie powstaje Cel ani Działanie.
4. Dodaje notatkę z poziomu książki. Widzi ją przy książce, w Wiedzy Projektu
   i globalnej Wiedzy, jako jeden rekord.
5. Opcjonalnie tworzy Działanie „Przeczytać rozdział 4” i planuje je na dziś.
   Książka jest powiązanym Materiałem. Działanie korzysta z obecnego Startu.
6. Opcjonalnie tworzy Cel „Zastosować trzy techniki” i powiązuje książkę/notatkę.
7. Oznacza książkę jako Przeczytana. Cel zastosowania wiedzy może nadal być aktywny.

## Proponowany kontrakt danych

Nazwy poniżej są propozycją kontraktu, nie opisem już wdrożonych pól.
Dokładny SQL dopasować do aktualnych tabel, RPC i wersjonowania przed implementacją.

| Obiekt | Rozszerzenie | Reguła |
| --- | --- | --- |
| Projekt / `areas` | `preset: standard | reading` | Domyślnie standard, jeden wybór |
| Kategoria | `defaultPreset?: standard | reading` | Tylko propozycja w formularzu tworzenia |
| Materiał / KnowledgeItem | `resourceFormat?: book` i typowane dane książki: autor, status czytania | `type` nadal resource; zwykłe materiały pozostają poprawne |
| KnowledgeLink | Znaczenie `source` dla Notatka → Materiał | Źródło nie jest Decyzją ani Rezultatem |

Preferowany zapis danych książki: pola na istniejącym `knowledge_items`,
powiązanym z tożsamością Wiedzy. Nie tworzyć drugiej, niezależnej kolekcji książek.
Walidować kombinacje typu, formatu i statusu na granicy komendy oraz w bazie.
Pola opcjonalne w starym odczycie muszą mieć jednoznaczne wartości domyślne.

Przy zmianie formatu książki na zwykły Materiał zachować dane książkowe, aby można
było wrócić do poprzedniego widoku. Jeżeli obecny edytor pozwala zmienić Materiał
na Notatkę/Decyzję, jawnie zablokować taką zmianę dla źródła mającego zależne
notatki, z czytelną przyczyną; nie tworzyć niepoprawnych relacji ani kasować ich.

W rozszerzeniu: bieżąca strona i liczba stron na książce, lokalizacja cytatu na
relacji źródła. Liczba stron dodatnia, bieżąca strona nieujemna i nie większa od
całości. Osiągnięcie ostatniej strony może proponować status Przeczytana, lecz
nie kończy żadnego Celu. Pierwsze wydanie pozwala zapisać numer strony w treści.

## Kolejność wdrożenia

Każdy etap jest pełnym, sprawdzalnym przepływem w demo i Supabase. Nie wydawać
samego UI z nietrwałymi polami. Wewnętrzne podzadania: kontrakt → zapis/odczyt →
UI → testy. Etapy 1–5 tworzą pierwsze kompletne wydanie.

### Etap 1 — szablon zapisany na Projekcie

Status: wdrożony; testy automatyczne i typecheck przechodzą. Kolumny `preset` i
`default_preset` są obecne w zdalnym schemacie; zapis/edycja zdalnych Projektów
nie były testowane na danych użytkownika.

- Dodać kontrakt, addytywną migrację, domyślne wartości i obsługę obu repozytoriów.
- Wprowadzić mały rejestr dwóch szablonów: etykieta, opis, domyślny widok,
  kolejność sekcji, główna akcja, sposób prezentowania pustego stanu.
- Dodać wybór w tworzeniu/edycji Projektu i opcjonalną propozycję w kategorii.
- Podłączyć istniejące wejścia, w tym Quick Add i szkice formularzy.
- Czytelnia w tym etapie eksponuje istniejącą Wiedzę; nie oferuje jeszcze
  niedziałających kontrolek książek.
- Rozdzielić brak pracy od problemu: brak Celu w Czytelni jest neutralny.
  Faktycznie zaplanowane, zaległe i zablokowane Działania zachowują sygnały.
- Nie zmieniać istniejącego układu Standardowego poza wspólną konfiguracją.

Odbiór: odświeżenie i drugie urządzenie zachowują szablon; konflikt kategorii
nie wybiera go losowo; usunięcie kategorii nie zmienia widoku; przełączanie
Standardowy ↔ Czytelnia nie zmienia liczby i treści powiązanych obiektów.

### Etap 2 — książki i półki

Status: wdrożony lokalnie; testy domeny, lokalnej paginacji, adaptera Supabase
i migracji przechodzą. Zdalne kolumny i RPC są obecne, a globalna lista Wiedzy
ładuje się w przeglądarce; zdalne zapisy książki nie były testowane.

- Rozszerzyć Materiał o format książki, autora i status czytania, z zapisem,
  odczytem szczegółu, list, filtrowaniem i eksportem.
- W Czytelni dodać główną akcję „Dodaj książkę” oraz „Połącz istniejącą”.
- Udostępnić filtry Wszystkie, Do przeczytania, Czytam, Przeczytane,
  Wstrzymane i Porzucone; zachować wybrany filtr w URL podczas powrotu.
- W globalnej Wiedzy zachować filtr Materiały i dodać zawężenie do Książek.
- Pokazać autora i status w wspólnej karcie Materiału. Na start używać
  istniejących list/kart, bez karuzeli i bez obowiązkowych okładek.
- Zwykły Materiał można jawnie oznaczyć jako książkę bez zmiany identyfikatora.
- Listy i liczniki korzystają z tego samego zbioru relacji i zasad widoczności;
  nie podwajają książki połączonej bezpośrednio oraz przez Cel.
- Przy paginacji filtrować także po stronie repozytorium; nie filtrować wyłącznie
  pierwszej pobranej strony. Półki uwzględniają wszystkie pasujące książki.

Odbiór: książka widoczna w dwóch Projektach pozostaje jednym rekordem;
zmiana statusu odświeża oba konteksty; kolejka nie zmienia liczników aktywnych
Celów i Działań; Archiwum i Kosz nie mieszają się ze statusem Przeczytana.

### Etap 3 — notatka ze źródłem

Status: wdrożony lokalnie; testy relacji źródła, granic Kosza, retry domenowym
i kontekstu Projektu przechodzą. Zdalne ograniczenia i RPC zostały wdrożone;
nie wykonywano zdalnego zapisu notatki na danych użytkownika.

- Wprowadzić i zwalidować relację `source` Notatka → Materiał.
- Na szczególe książki pokazać notatki oraz akcje dodania i powiązania istniejącej.
- Na szczególe notatki pokazać źródło i powrót do książki, bez etykiety
  „Potwierdza decyzję”. Zachować dotychczasowy przepływ potwierdzania Decyzji.
- Tworzenie notatki i jej relacji musi być atomowe, idempotentne i korzystać
  z obecnego mechanizmu komend. Retry nie może zostawić duplikatu lub sieroty.
- Pokazać domyślny kontekst Projektu i umożliwić jego zmianę przed zapisem.
- Aktualizować widoki, liczniki i cache po utworzeniu, edycji i odłączeniu.
- Obsłużyć listę notatek także po bezpośrednim wejściu z URL oraz poza pierwszą
  stroną globalnej Wiedzy; nie polegać wyłącznie na początkowym stanie aplikacji.

Odbiór: notatka istnieje raz, ma poprawne źródło, pojawia się w wybranym
Projekcie i globalnej Wiedzy; usunięcie jednego powiązania nie kasuje treści.
Nie można utworzyć relacji źródła między różnymi Workspace'ami.

### Etap 4 — spójność z Celami, Działaniami i Startem

Status: wdrożony lokalnie; testy atomowych relacji Goal/Action i Quick Add
przechodzą. Zdalne RPC atomowych relacji są obecne; nie wykonywano zdalnego
tworzenia Celu ani Działania na danych użytkownika.

- Z książki umożliwić otwarcie istniejącego formularza Działania/Celu z
  kontekstem Projektu i książką jako Materiałem. Nie tworzyć nowych edytorów.
- Przy wielu Projektach użyć bieżącego kontekstu nawigacji, a w globalnym
  wejściu pozwolić wybrać Projekt albo pozostać bez Projektu.
- Przy wyborze istniejącego Celu respektować jego Projekt; nie zapisywać
  sprzecznego `areaId` pochodzącego z miejsca otwarcia książki.
- Tworzenie obiektu z powiązaniem musi być atomowe albo korzystać z istniejącej
  równoważnej gwarancji odtwarzania komendy; nie pokazywać sukcesu częściowego.
- Zachować zwykłe planowanie, statusy Działań, kryteria i zakończenie Celów.
- Sprawdzić Start, przegląd tygodnia oraz kontekst obecnego AI: książki na
  później nie stają się zaległościami, przeczytanie nie jest osiągnięciem Celu.
- Nie dodawać nowej funkcji AI; zmieniać jego dane wejściowe tylko tam, gdzie
  obecne mechanizmy wymagają obsługi rozszerzonego Materiału.
- Globalny capture nadal trafia do Skrzynki; zapis w Czytelni bezpośrednio
  tworzy Materiał. Przy ręcznym przetwarzaniu Skrzynki umożliwić format Książka
  z zachowaniem pochodzenia, bez obowiązkowego rozpoznawania przez AI.

Odbiór: 30 książek w kolejce nie powoduje 30 sugestii pracy; jedno zaplanowane
Działanie czytania trafia do Startu; osiągnięcie Celu i status książki są niezależne.

### Etap 5 — kompatybilność i odbiór wydania

Status: zaimplementowany lokalnie; dodano Czytelnię demo, odczyt/eksport
metadanych, zgodność starych snapshotów oraz testy RLS i filtrów. `pnpm lint`,
`pnpm typecheck`, `pnpm test` i `pnpm build` przechodzą. Dwie migracje są
wdrożone; historia, nowe kolumny, RPC i pusty `search_path` dla `get_knowledge_page`
potwierdzono zdalnie. Globalna lista Wiedzy załadowała się w przeglądarce.
Przegląd demo wczytał wcześniejszy zapisany snapshot bez przykładowej Czytelni;
nie resetowano tych danych. Nie wykonywano zdalnych zapisów testowych.

- Sprawdzić wszystkie ścieżki odczytu, nie tylko główny bootstrap: szczegół,
  paginację, wyszukiwanie, odświeżanie cache, eksport i istniejące odtwarzanie
  danych. Nie budować nowego importera, jeżeli aplikacja go nie posiada.
- Wyszukiwanie powinno znajdować książkę po tytule i autorze oraz notatkę po
  treści; wynik prowadzi do tej samej tożsamości niezależnie od Projektu.
- Sprawdzić stare szkice i snapshoty demo; brak nowych pól nie uniemożliwia
  odczytu. Aktualizacja starej części danych nie usuwa nowych pól.
- Sprawdzić izolację Workspace'u, granty, RLS i transakcje nowych komend.
- Dodać przykładową Czytelnię do danych demo bez zmiany danych użytkownika.
- Wykonać pełny scenariusz na telefonie, desktopie i klawiaturą, również przy
  błędzie zapisu, retry, wolnym odczycie, pustej półce i długim tytule.
- Zaktualizować aktualną część `CONTEXT.md` po implementacji, a nie przedstawiać
  proponowanych funkcji jako już istniejących.

Odbiór: pełen scenariusz z sekcji „Docelowy przepływ” działa w obu trybach;
przechodzą `pnpm lint`, `pnpm typecheck`, `pnpm test` i `pnpm build`.
Raport osobno wymienia testy automatyczne, odbiór przeglądarkowy oraz sprawdzenie
na podłączonym środowisku. Brak dostępu nie jest potwierdzeniem działania backendu.

### Etap 6 — rozszerzenia po użyciu pierwszej wersji

W tej kolejności, tylko jeśli potrzebne: licznik stron i lokalizacja źródła,
okładki, potem szablony Nauka i Baza wiedzy. Okładki wymagają osobnej decyzji
o źródle i przechowywaniu oraz obsługi braku/błędu obrazka. Nie dodawać od razu
zewnętrznych katalogów książek, OCR, importów Kindle, serii czytelniczych,
uniwersalnego kreatora szablonów ani osobnych silników kursów i rozdziałów.

## Mapa implementacji

| Obszar | Główne miejsca do zmiany |
| --- | --- |
| Model i reguły | `apps/web/src/domain/types.ts`, `commands.ts`, `knowledge.ts`, `projectModule.ts`, `quickAdd.ts`, `labels.ts`; nowy mały rejestr szablonów |
| Trwałość | `apps/web/src/app/store-context.ts`, `store.tsx`, repozytoria w `apps/web/src/data/`, istniejące RPC/komendy i addytywne migracje w `supabase/migrations/` |
| Kategorie i Projekty | `ProjectCategoryManager.tsx`, `ProjectCategoryPicker.tsx`, `ProjectsPage.tsx`, `ProjectDetailPage.tsx` |
| Wiedza i dodawanie | `KnowledgePage.tsx`, `KnowledgeDetailPage.tsx`, `QuickAdd.tsx`, istniejące formularze przetwarzania Skrzynki |
| Integracja | `GlobalSearch.tsx`, istniejące formularze Celów/Działań, eksport, dane demo; selektory Startu i przeglądu tylko w potrzebnym zakresie |

## Migracja, wdrożenie i wycofanie

1. Przed pracą sprawdzić bieżący diff i obowiązujące instrukcje. Zachować zmiany
   użytkownika, w tym istniejące nieśledzone kopie plików; nie sprzątać ich w tym zadaniu.
2. Przed implementacją backendu sprawdzić aktualną dokumentację Supabase oraz
   definicje tabel/RPC. Plan nie zastępuje inspekcji SQL i polityk dostępu.
3. Dodać pola, walidacje i komendy w sposób zgodny z odczytem starych rekordów.
   Nie usuwać tabel ani nie przepisywać historycznych Projektów na książki.
4. Zapewnić zgodność starego klienta z nowym zapisem: aktualizacje częściowe
   zachowują nieznane pola. Nowe znaczenie relacji wymaga sprawdzenia starych
   czytników; nie zakładać, że dowolna stara wersja UI je obsłuży.
5. Odtworzyć migracje i scenariusze danych lokalnie, następnie na autoryzowanym
   środowisku testowym. Backend wdrażać przed klientem korzystającym z nowych pól.
6. W razie problemu wyłączyć wejścia Czytelni lub wdrożyć zgodny widok Standardowy
   z obsługą nowych danych. Nie usuwać kolumn, książek ani relacji źródeł.

Ten dokument zleca przygotowanie planu, nie wdrożenie zdalne ani commit.

## Główne ryzyka i zabezpieczenia projektowe

| Ryzyko | Przyjęte rozwiązanie |
| --- | --- |
| Kilka kategorii narzuca różne zachowania | Jeden jawnie zapisany szablon Projektu |
| Kolejka czytelnicza przeciąża Start | Brak automatycznych Celów, Działań i terminów |
| Książka/notatka występuje w kilku kopiach | Jedna Wiedza, wiele relacji |
| Notatka znika z Projektu mimo związku z książką | Jawna relacja kontekstu przy zapisie |
| Półki i liczniki pomijają dalsze strony | Filtrowanie i pobieranie w repozytorium, test z wieloma stronami |
| Zmiana wyglądu usuwa dane | Szablon nie jest konwersją ani migracją treści |
| Powstaje rozbudowany silnik konfiguracji | Dwa stałe szablony i ograniczony rejestr prezentacji |

## Stan weryfikacji przy sporządzaniu planu

Przejrzano model, główne ekrany i przepływy w kodzie. W poprzedzającym audycie
przeszło 49 testów w `projectModule.test.ts`, `knowledge.test.ts`,
`quickAdd.test.ts` i `homeSummary.test.ts`. To punkt odniesienia obecnego
zachowania, nie weryfikacja planowanych funkcji. Nowe migracje, rzeczywisty
backend i przepływ przeglądarkowy pozostają do sprawdzenia podczas wdrażania.
