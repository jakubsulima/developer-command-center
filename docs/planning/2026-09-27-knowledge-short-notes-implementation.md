# Wiedza i krótkie notatki — plan wykonawczy dla kolejnego modelu

Data: 27 września 2026. Status: plan, bez wdrożenia zmian opisanych poniżej.

## 1. Cel i kontekst użytkownika

Użytkownik poprosił o audyt Wiedzy, zbędnych elementów i możliwości rozwoju,
z uwzględnieniem dodanej obsługi książek. Następnie doprecyzował:
„krótkie notatki raczej będą dominować”. Ten dokument jest planem przekazania
implementacji kolejnemu modelowi, a nie poleceniem zmiany danych użytkownika.

Docelowy przepływ: otwieram książkę → zapisuję jedną myśl → wracam do czytania.
Zapis wymaga tylko treści. Źródło jest zachowane, szkic nie ginie, a myśl można
później znaleźć i opcjonalnie zamienić w konkretne Działanie.

Potwierdzona preferencja: dominują krótkie notatki. Szczegóły interakcji poniżej
są proponowanymi decyzjami wykonawczymi, nie osobno zatwierdzonymi wymaganiami
użytkownika. Nie blokować implementacji drobnymi pytaniami; uzasadnione odstępstwa
zapisać w raporcie. Nie rozszerzać zakresu na osobny system nauki.

## 2. Najpierw sprawdź aktualny stan

Repozytorium: `/Users/jakub/Documents/project-learning-app`.

1. Przeczytaj obowiązujące AGENTS.md, aktualną część CONTEXT.md, git status i diff.
2. Zachowaj istniejące, liczne zmiany oraz nieśledzone pliki. Nie resetuj drzewa,
   nie usuwaj kopii z nazwą „ 2”, nie nadpisuj implementacji Czytelni.
3. Przeczytaj `docs/planning/2026-09-26-project-presets-and-reading-library.md`.
   To źródło zasad książek, relacji, szablonów i wcześniejszych kryteriów odbioru.
   Nowy plan uzupełnia tamtą implementację, nie zleca jej ponownego napisania.
4. Nagłówek poprzedniego planu i README podają, że 27 września wdrożono migracje
   `20260926150321_project_presets_and_reading_library.sql` oraz
   `20260927054544_lock_knowledge_page_search_path.sql`, a odczyt działa.
   Dalsze akapity nadal zawierają starsze informacje o niewdrożonej migracji.
   Zweryfikuj aktualny stan; nie wdrażaj ponownie na podstawie starego audytu.
5. Zapisz krótki stan wejściowy: co odtworzono, co naprawiono wcześniej, czego
   nie dało się sprawdzić. Nie traktuj dokumentacji jako testu działającego UI.

### Dowody i ograniczenia poprzedniego audytu

- W interfejsie potwierdzono: Dodaj z filtra Książki otwierało Notatkę;
  błąd pobierania współistniał z komunikatem pustej listy.
- Obserwowany projekt „Wiedza książkowa” miał standardowy widok z zachętą do
  utworzenia Celu. Nie zmieniaj automatycznie szablonu projektu po jego nazwie.
- W Bibliotece widziano 6 wpisów, ale nie zweryfikowano konkretnych książek.
  Błąd odczytu nie stanowi dowodu ich braku.
- Kod wskazywał problemy filtrów, paginacji, menu starszych wpisów i powrotu
  z detalu. Te ustalenia wymagają regresji na aktualnym checkoutcie.
- Przeszło 19 testów w knowledge.test.ts, projectPresets.test.ts,
  projectModule.test.ts i KnowledgeDetailPage.test.tsx. Nie był to pełny odbiór.
- W trakcie przygotowania planu pojawiła się nowsza dokumentacja wdrożenia;
  błąd backendu należy ponownie odtworzyć, nie przedstawiać jako nadal pewny.

## 3. Zakres i granice

### Pierwsze kompletne wydanie: etapy A–E

- Niezawodne wyniki, filtry, paginacja i powrót do listy.
- Kontekstowe dodawanie książek, materiałów, decyzji i notatek.
- Krótka notatka: treść najpierw, opcjonalny tytuł, ukryte opcjonalne powiązania.
- Szkice chronione przed zamknięciem, zmianą trasy i błędem zapisu.
- Notatka bezpośrednio przy książce, wygodna lista notatek, czytelne źródło.
- Zmiana statusu czytania bez pełnej edycji książki.
- Spójność globalnej Wiedzy, Projektu i ręcznego przetwarzania Skrzynki.

### Osobny, następny etap F

- „Utwórz Działanie” z notatki, z zachowaniem kontekstu i relacji.
- Wyróżnienie notatki, jeśli realizowany jest cały pakiet z poprzedniej propozycji.
  Nie jest blokadą wydania A–E; musi być raportowane jako osobny zakres.

### Poza tym planem

AI, fiszki, algorytm powtórek, graf wiedzy, import Kindle/OCR/ISBN, okładki,
liczniki stron i serie czytelnicze, obowiązkowe tagi, rich text, współpraca
zespołowa. Stronę lub rozdział zapisujemy na razie opcjonalnie w treści notatki,
bez nowego modelu lokalizacji. Nie tworzymy automatycznych Celów i Działań.

## 4. Reguły danych i zachowania

### 4.1. Notatka i tytuł

- Nowa szybka Notatka wymaga niepustej treści po trim().
- Pole „Tytuł — opcjonalnie” jest pod „Więcej”. Nie wymagać drugiego pola.
- Zachowaj istniejący kontrakt niepustego `KnowledgeItem.title`: przed wysłaniem
  komendy wylicz tytuł z pierwszej niepustej linii treści, jeżeli użytkownik nie
  podał własnego. Nie używaj AI i nie zmieniaj tytułu na nullable.
- Wspólna funkcja, np. `prepareKnowledgeNote`, obsługuje wszystkie nowe wejścia.
  Proponowany tytuł: znormalizowane białe znaki, maksymalnie 100 punktów kodowych
  (albo mniej, jeśli istniejący kontrakt ma niższy limit), z wielokropkiem przy
  skróceniu. Zachowaj pełną treść z podziałem na linie w `detail`.
- Tytuł jest utrwalany przy utworzeniu. Późniejsza edycja treści nie zmienia go
  automatycznie; bez nowego pola pochodzenia nie da się bezpiecznie rozpoznać,
  czy stary tytuł był ręczny. Użytkownik może edytować go pod „Więcej”.
- Istniejące notatki z samym tytułem nadal są poprawne i edytowalne; nie migruj
  ich hurtowo i nie blokuj zapisu z powodu braku treści w starym rekordzie.
- Walidację Decyzji, Materiału i Rezultatu zachowaj. Rezultat nadal powstaje
  zgodnie z dotychczasowym przepływem Działania, nie przez nowy formularz.
- Nie dokładaj sztywnego niskiego limitu treści; „krótka” opisuje wygodny tryb,
  nie zakaz zapisania dłuższej notatki.

### 4.2. Książka, źródło i Projekt

- Książka pozostaje Materiałem z `resourceFormat: book`, jednym rekordem
  w Workspace, nawet jeśli występuje w kilku Projektach.
- Notatka wskazuje książkę przez `source`, nie przez relację potwierdzającą Decyzję.
- Wejście z Projektu: proponuj bieżący, aktywny Projekt; pozwól zmienić lub usunąć
  go pod „Więcej”. Globalne wejście nie kopiuje wszystkich Projektów książki.
- Notatkę i jej relacje zapisuj atomowo. Nie pokazuj sukcesu częściowego.
- Książka w Koszu: odczyt źródła pozostaje możliwy, nowe notatki/powiązania
  zablokowane. Archiwum nie jest Koszem i nie usuwa notatek.
- W aktywnej liście notatek książki wyklucz Kosz i Archiwum; umożliwiaj ich
  odnalezienie w odpowiednim widoku Wiedzy. Istniejące relacje zachowaj.
- Status czytania nie kończy Celu ani Działania i nie zmienia widoczności.

### 4.3. Szkic i zapis

- Ponownie wykorzystaj `usePersistentDraft`, `DraftStatus`, `DraftCloseGuard`
  i istniejącą obsługę konfliktów; nie buduj drugiej usługi autosave.
- Klucz szkicu izolowany przez użytkownika, Workspace, rodzaj wejścia oraz
  książkę/Projekt. Szkic książki A nie pojawia się przy książce B.
- Przechowuj treść, opcjonalny tytuł, jawne powiązania i stabilny klucz
  idempotencji. Ten sam klucz podczas retry po niepewnym wyniku zapisu.
- „Zamknij” zachowuje szkic. „Odrzuć szkic” usuwa go jawnie. Sukces zapisu
  czyści tylko właściwy szkic i rozpoczyna nową intencję z nowym kluczem.
- Flush przed zamknięciem i zmianą kontekstu również przed upływem 450 ms.
  Jeśli lokalny zapis zawiedzie, zachowaj edytor i udostępnij kopiowanie treści.
- Szkic lokalny nie jest synchronizacją między urządzeniami; komunikaty mają
  mówić „Szkic na tym urządzeniu”, a nie sugerować zapis do Biblioteki.
- Obsłuż sytuację: zapis serwera się udał, ale usunięcie lokalnego szkicu nie.
  Nie sugeruj ponownego utworzenia z nowym kluczem i nie pozostawiaj duplikatu.
- Enter dodaje nową linię, Ctrl/Cmd+Enter zapisuje; uwzględnij składanie IME.

## 5. Etapy implementacji

### A. Niezawodność listy i filtrów

1. Odtwórz filtr książek po aktualnych migracjach. Przy braku zgodnego schematu
   pokaż czytelny błąd kompatybilności zamiast pustego wyniku. Nie ukrywaj go
   lokalnym filtrowaniem pierwszych 50 rekordów.
2. Uporządkuj renderowanie: loading bez pustego stanu; error z retry; empty
   dopiero po udanym odczycie. Przy błędzie kolejnej strony zachowaj dotychczasowe
   wyniki i pokaż retry tej strony. Nie deklaruj kompletności listy po błędzie.
3. Rozszerz wspólny kontrakt filtrów strony Wiedzy o Projekt i widoczność;
   podłącz Cel również do repozytorium. Zdefiniuj semantykę w jednym miejscu:
   Projekt według istniejącego `projectKnowledgeIds`, Cel bezpośrednio lub
   przez Działanie z tym Celem. Nie dodawaj rekurencji przez inne wpisy Wiedzy.
4. Filtruj przed LIMIT/cursorem w repozytorium lokalnym i backendzie. Zachowaj
   deterministyczne sortowanie i rozstrzyganie remisu przez id. Wszystkie filtry
   muszą należeć do query key. Resetuj cursor po zmianie filtrów.
5. „Załaduj starsze” zależy od nextCursor, nie od liczby wyników po filtrze.
   Licznik Biblioteki nie może udawać pełnej liczby na podstawie pierwszej strony;
   wykorzystaj prawdziwy count albo jawnie opisuj liczbę wczytanych pozycji.
6. Scalaj nowe/lokalnie zmienione rekordy bez duplikatów i z tym samym filtrem
   oraz sortowaniem; stary snapshot nie może wskrzeszać zarchiwizowanego wpisu.
7. Menu operacji rozwiązuje rekord z tego samego scalonego zbioru co lista.
8. `q`, widoczność, rodzaj, Projekt, Cel i status zachowuj w URL. Pisanie nie
   tworzy wpisu historii dla każdej litery; debounce zapytań około 250 ms.
   Powrót zachowuje filtr i istniejący mechanizm pozycji/fokusu karty.
9. Kliknięcie innego rodzaju niż Książki czyści readingStatus. „Wszystkie”
   czyści rodzaj/format/status, ale zachowuje jawne Projekt/Cel/wyszukiwanie.
   Osobne „Wyczyść filtry” resetuje cały zestaw. Czytelnie pokazuj aktywne filtry.
10. Status czytania eksponuj tylko w kontekście Książek. Znormalizuj również
    sprzeczne parametry wklejonego URL, nie tylko kliknięcia UI.

Odbiór: zestaw ponad 100 wpisów, pasujący wpis wyłącznie po pierwszych 50;
wynik jest osiągalny dla Projektu, Celu i Archiwum. Menu, retry i powrót działają.

### B. Wspólny formularz krótkiej notatki

1. Wydziel mały współdzielony formularz treści i opcjonalnych pól oraz funkcję
   normalizacji; nie twórz uniwersalnego kreatora wszystkich encji.
2. Kolejność: textarea „Zapisz myśl…” → dyskretne źródło/kontekst → „Więcej”
   → status szkicu i przycisk „Zapisz notatkę”. Autofocus w textarea.
3. Pod „Więcej”: tytuł, opcjonalne powiązania, wybór źródła tam, gdzie jest
   potrzebny. Źródło znane z książki nie wymaga ponownego wyboru.
4. Zintegruj Bibliotekę, formularz Wiedzy Projektu i notatkę przy książce.
   W ręcznym triage Skrzynki zachowaj oryginał i pochodzenie; nowa Notatka używa
   tej samej normalizacji. Nie zmieniaj zakresu obecnego AI triage.
5. Dodaj szkice zgodnie z sekcją 4.3 i nie gub zawartości przy przełączeniu rodzaju.
   Unikaj montowania dwóch edytorów zapisujących jednocześnie ten sam klucz.
6. Dodaj kontekstowe domyślne wartości: Książki → Materiał/książka;
   Materiał → Materiał; Decyzja → Decyzja; Notatka/Wszystkie → Notatka.
   Przy filtrze Rezultat nie udawaj bezpośredniego tworzenia: wyjaśnij istniejący
   przepływ przez Działanie. Przy filtrze Projektu proponuj ten Projekt.

Odbiór: zapis samej treści daje jeden poprawny rekord z niepustym tytułem;
zamknięcie, odświeżenie, retry i zmiana książki nie gubią ani nie mieszają szkiców.

### C. Książka jako wygodne miejsce zapisu

1. Przenieś listę notatek książki do głównej kolumny. Metadane i „Połącz z pracą”
   mogą pozostać drugorzędne; nie projektuj szczegółu od nowa dla innych typów.
2. Jedno główne wejście „Zapisz myśl…” otwiera/osadza formularz z etapu B bez
   opuszczania książki. Usuń zdublowane przyciski otwierające ten sam edytor.
3. Po sukcesie nowa notatka jest widoczna, pole gotowe do następnej, fokus
   pozostaje przewidywalny. Brak pełnego przeładowania i skoku strony.
4. Pełna treść krótkiej notatki na liście; dla dłuższej „Pokaż więcej”.
   Proponowany próg: ponad 600 znaków lub 8 linii. Nie powielaj pierwszej linii
   jako identycznego nagłówka i treści; stare wpisy bez detail pokazują title.
5. Źródło jako klikalna nazwa książki, opcjonalnie autor. Pokazuj oznaczenie
   źródła w Archiwum/Koszu. Klikanie źródła nie uruchamia równocześnie notatki.
6. Przy książce zapewnij szukanie w jej notatkach po treści/tytule i sortowanie
   od ostatniej aktualizacji. Nie filtruj jedynie początkowej strony notatek.
   Pobieranie musi obsługiwać bezpośredni URL i źródła poza początkowym store.
7. Dodaj zmianę statusu książki w nagłówku lub menu bez pełnej edycji.
   Użyj istniejącej komendy, wersjonowania i cache invalidation; zapewnij błąd,
   retry i cofnięcie bez nadpisywania późniejszych zmian innego klienta.

Odbiór: ta sama książka w dwóch Projektach ma jeden status; notatka z Projektu
ma źródło i jawny Projekt, globalna nie dziedziczy wszystkich Projektów książki.

### D. Lista Wiedzy i mniej zbędnych elementów

1. W globalnej Bibliotece książka ma etykietę „Książka”, autora i status.
2. Krótkie notatki pokazują treść i źródło zamiast wyłącznie tytułu oraz licznika
   relacji. Ogranicz metadane do tych pomocnych przy rozpoznaniu wpisu.
3. „Źródło: Skrzynka” pozostaje w szczególe; nie zastępuje treści na liście.
4. Istniejąca kategoria Projektu nie zmienia automatycznie jego szablonu.
   Sprawdź odkrywalność wyboru Czytelni w edycji. Nie przełączaj prawdziwego
   projektu „Wiedza książkowa” w ramach testowania ani po samej nazwie.
5. Materiały, Decyzje i Rezultaty zachowują czytelne, właściwe dla nich pola.
   Nie dodawaj do wszystkich kart akcji i pól właściwych tylko dla książek.

Odbiór: czytelne listy na 390 px i desktopie, długie linki nie powodują
poziomego przewijania, elementy interaktywne są dostępne klawiaturą.

### E. Odbiór całości i aktualizacja dokumentacji

Wykonaj macierz z sekcji 7. Zaktualizuj aktualne reguły w CONTEXT.md i status
tego planu. Uporządkuj tylko sprzeczne informacje o wdrożeniu książek, które
zweryfikowano; nie oznaczaj historycznych testów jako wykonanych ponownie.
Raportuj oddzielnie: lokalną implementację, migracje, testy automatyczne,
przeglądarkę i zdalny scenariusz zapisu. Brak dostępu to ograniczenie, nie sukces.

### F. Wykorzystanie i wyróżnianie notatek — osobny przyrost

1. „Utwórz Działanie” otwiera istniejący QuickAdd. Treść notatki jest kontekstem,
   a użytkownik sam zatwierdza tytuł Działania. Nie twórz go na samo kliknięcie.
2. Sprawdź istniejący kontrakt `materialKnowledgeIds`: nie zakładaj, że akceptuje
   Notatkę. Jeśli nie, rozszerz go o typowane relacje odpowiednie dla Notatki;
   nie oznaczaj Notatki jako Materiału, żeby obejść walidację.
3. Zachowaj link do notatki; opcjonalnie książkę jako materiał. Projekt wybranego
   Celu ma pierwszeństwo przed kontekstem wejścia. Zapis i relacje są atomowe,
   a anulowanie nie zmienia danych. Nie przenoś notatki poza Bibliotekę.
4. „Wyróżnij” to prosta, odwracalna flaga, bez punktacji i przypomnień. Jeśli
   zostaje wdrożona, wymaga trwałego pola, migracji, obsługi obu repozytoriów,
   eksportu, filtrowania przed paginacją i synchronizacji; nie używaj wyłącznie
   localStorage. Stare rekordy domyślnie niewyróżnione.
5. Nie zmieniaj domyślnej kolejności całej Wiedzy na podstawie wyróżnienia;
   dodaj osobny filtr. Nazwę i dokładny kontrakt pola wybierz po inspekcji modelu.

## 6. Mapa kodu do sprawdzenia

Ścieżki względem katalogu repozytorium:

| Obszar | Pliki |
| --- | --- |
| Lista, filtry, tworzenie | apps/web/src/pages/KnowledgePage.tsx |
| Szczegół, źródła, notatki książki | apps/web/src/pages/KnowledgeDetailPage.tsx |
| Projekt i Czytelnia | apps/web/src/pages/ProjectDetailPage.tsx; domain/projectPresets.ts; domain/projectModule.ts; hooks/useProjectKnowledgeItems.ts |
| Skrzynka i QuickAdd | apps/web/src/pages/InboxPage.tsx; components/QuickAdd.tsx; components/appQuickAddRequest.ts; components/AppShell.tsx |
| Rodzaje i reguły | apps/web/src/domain/knowledge-kinds.ts; knowledge.ts; types.ts; commands.ts; labels.ts |
| Store i komendy | apps/web/src/app/store.tsx; store-context.ts |
| Odczyt i zapis | apps/web/src/data/workspaceRepository.ts; localWorkspaceRepository.ts; supabaseWorkspaceRepository.ts; supabaseRepository.ts |
| Paginacja i klucze cache | apps/web/src/hooks/useWorkspaceInfinitePage.ts |
| Szkice | apps/web/src/hooks/usePersistentDraft.ts; components/DraftStatus.tsx; DraftCloseGuard.tsx; DraftConflictNotice.tsx |
| Wygląd | apps/web/src/pages/focus-detail.css oraz istniejące style Wiedzy, odnalezione przez rg |
| Backend | supabase/migrations/; definicje aktualnych RPC odszukaj przed zmianą |
| Testy | sąsiadujące *.test.ts(x), apps/web/src/test/migrations.test.ts |

Nie zmieniaj kontraktu Supabase z pamięci. Przeczytaj umiejętność supabase przy
pracach backendowych i aktualne definicje RPC. Planowanie nie wymaga osobnego
refaktoru repozytoriów ani przepisywania całego store.

## 7. Macierz testów i kryteria odbioru

| Scenariusz | Oczekiwany wynik |
| --- | --- |
| Sama treść, bez tytułu | Poprawny tytuł z pierwszej niepustej linii, pełna treść zachowana |
| Puste/białe znaki | Brak zapisu, czytelna walidacja |
| Emoji, polskie znaki, długa pierwsza linia | Brak uszkodzenia znaków i utraty treści |
| Własny tytuł | Zachowany po zapisie i edycji treści |
| Stara notatka tylko z tytułem | Nadal wyświetlana i edytowalna |
| Decyzja bez uzasadnienia | Nadal odrzucana |
| Książka A/B, dwa Projekty, dwa Workspace'y | Brak mieszania szkiców i relacji |
| Zamknięcie przed debounce, powrót, reload | Ostatnia treść szkicu przywrócona |
| Błąd localStorage | Brak fałszywego potwierdzenia, możliwość skopiowania treści |
| Timeout po zapisie serwera i retry | Jeden rekord i jeden komplet relacji |
| Zapis udany, czyszczenie szkicu nieudane | Brak nowego duplikatu przy wznowieniu |
| Źródło poza pierwszymi 50 wpisami | Widoczne i klikalne, retry przy błędzie |
| Ponad 100 wpisów, filtry Projekt/Cel/Kosz | Kompletne wyniki, stabilna paginacja bez duplikatów |
| Książki → Czytam → Notatki/Wszystkie | Brak ukrytego, sprzecznego statusu czytania |
| Pusty wynik / ładowanie / błąd | Trzy odrębne stany |
| Błąd następnej strony | Widoczne dotychczasowe dane i retry |
| Menu starszego rekordu | Działa archiwizacja, przywracanie i cofnięcie |
| Szczegół → powrót | Zachowane q, filtry, widoczność i nawigacja do karty |
| Nowa notatka z książki w Projekcie | Jedna notatka, relacja source i wybrany Projekt |
| Globalna notatka książki | Bez automatycznego rozprzestrzeniania na Projekty |
| Książka w Koszu | Brak nowych relacji; stare źródło pozostaje czytelne |
| Archiwalna/usunięta notatka | Nie pojawia się jako aktywna notatka książki |
| Zmiana statusu książki | Odświeża wszystkie konteksty, nie kończy Celu |
| Konflikt wersji przy statusie/edycji | Brak cichego nadpisania zmian |
| Telefon, desktop, klawiatura | Czytelność, poprawny fokus i brak nakładających się akcji |
| Etap F: anulowanie Działania | Nie tworzy obiektu ani relacji |
| Etap F: wyróżnienie + eksport/reload | Flaga trwała, zgodna we wszystkich widokach |

Testuj na poziomie odpowiednim dla ryzyka: normalizacja jako unit, zachowania
formularza/listy jako komponent, filtry i komendy w obu repozytoriach, SQL dla
zmienianych RPC oraz izolacji Workspace. Dodaj regresje odtwarzające problemy,
nie testy odwzorowujące samą strukturę implementacji.

Po zmianach uruchom właściwe testy celowane, następnie `pnpm lint`,
`pnpm typecheck`, `pnpm test` i `pnpm build`. Przeglądarką sprawdź pełen przepływ
na danych demo/testowych. Nie resetuj istniejącego demo użytkownika ani nie
twórz testowych książek na jego koncie bez odpowiedniego zakresu zlecenia.

## 8. Migracje, wydanie i cofnięcie

- Etap B nie powinien wymagać migracji tytułów: adapter formularza wysyła
  dotychczasowy poprawny kontrakt. Filtry A i opcjonalne wyróżnienia F mogą
  wymagać addytywnych migracji; najpierw sprawdź aktualny schemat.
- Zachowaj stare sygnatury/kompatybilny odczyt tam, gdzie aktualny klient ich
  potrzebuje. Przy zmianach RPC sprawdź granty, RLS, search_path i eksport.
- Backend z nowym kontraktem wdrażaj przed klientem wymagającym tych pól.
  Bieżące zlecenie dotyczy planu i samo nie autoryzuje zdalnego wdrożenia.
  Przy późniejszym zleceniu implementacji działaj w jego rzeczywistym zakresie.
- W razie regresji wycofaj nowe wejście UI, zachowując zapisane rekordy i relacje.
  Nie usuwaj kolumn ani nie konwertuj książek/notatek, żeby cofnąć wygląd.
- A → B → C → D → E to zalecana kolejność; F jest kolejnym przyrostem.
  Nie rozpoczynaj funkcji późniejszych zamiast domknięcia A–E.

## 9. Oczekiwany raport końcowy implementacji

Wymień ukończone etapy, zmienione zachowania, wyniki testów, rzeczywiście
sprawdzone scenariusze przeglądarkowe, status migracji i konkretne ograniczenia.
Pokaż, jak zapisać krótką notatkę oraz jak wrócić do źródła. Osobno podaj
niezrealizowany etap F. Nie opisuj pomysłów odłożonych jako istniejących funkcji.

## 10. Polecenie startowe do przekazania modelowi

> Pracuj w /Users/jakub/Documents/project-learning-app. Zaimplementuj etapy A–E
> z docs/planning/2026-09-27-knowledge-short-notes-implementation.md.
> Najpierw zweryfikuj aktualny stan i zachowaj wszystkie istniejące zmiany;
> obsługa książek jest już częściowo zaimplementowana i wdrożona. Użytkownik
> preferuje krótkie notatki: jedna wymagana treść, opcjonalny tytuł, zachowane
> źródło i szkic. Napraw potwierdzone regresje, wykonaj testy i odbiór
> przeglądarkowy. Etap F zostaw jako osobny przyrost. Nie zmieniaj danych
> użytkownika na potrzeby testów. Raportuj faktycznie zweryfikowany stan.
