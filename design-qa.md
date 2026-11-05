# Kontrola redesignu A / Focus

Data: 12 września 2026. Zakres: szczegóły pojedynczego Działania, Celu i Wiedzy.

## Referencja i decyzje

- [Makieta A](docs/planning/assets/focus-detail-redesign-A.png).
- [Plan](docs/planning/2026-09-12-focus-detail-redesign.md), z późniejszą decyzją użytkownika o zachowaniu granatowo-niebieskiej palety.
- Porównanie dotyczy hierarchii, proporcji sekcji i rozmieszczenia operacji. Przykładowe treści, liczby i daty makiety nie zastępują danych aplikacji.

## Rozbieżności poprawione w tej iteracji

1. Działanie: uporządkowany kontekst nadrzędny, płaskie sekcje opisu, materiałów i rezultatów, pełna szerokość głównego przycisku. Dłuższe grupy powiązań mają rozwijanie; formularz łączenia jest zwinięty.
2. Cel: zwarta karta następnego kroku, usunięte powielone kryteria oraz podwójna wizualizacja checkboxów. Edycja wyróżnionego Działania jest dostępna w menu. Jego szczegółowe powiązania są dostępne po przejściu do Działania. Kryteria są stale widoczne, historia i pozostałe grupy zwijane.
3. Wiedza: treść ma pierwszeństwo, Projekty i pozostałe relacje tworzą jedną sekcję Powiązania. Zachowane zostały potwierdzenia decyzji i obsługa relacji. Brak daty nie jest zastępowany bieżącą datą.
4. Wspólny układ: spójne marginesy, separatory, typografia, nagłówek mobilny i nawigacja. Desktop wykorzystuje dwie kolumny; wąski ekran układa sekcje pionowo.
5. Interakcje: wybór następnego Działania kieruje fokus do właściwej kontrolki; formularz postępu otrzymuje fokus po otwarciu.

## Dowody wizualne

W katalogu [zrzutów](docs/design/focus-detail-redesign/) znajdują się obrazy przed i po zmianie. Końcowe pliki demo mają nazwy `{goal,action,knowledge}-{360,390,768,1440}.png` w podkatalogu `after`.

| Ekran | Demo, 390 px | Dane użytkownika, 390 px | Desktop, 1440 px |
| --- | --- | --- | --- |
| Działanie | [zrzut](docs/design/focus-detail-redesign/after/action-390.png) | [zrzut](docs/design/focus-detail-redesign/after/real-action-390.png) | [zrzut](docs/design/focus-detail-redesign/after/action-1440.png) |
| Cel | [zrzut](docs/design/focus-detail-redesign/after/goal-390.png) | [zrzut](docs/design/focus-detail-redesign/after/real-goal-390.png) | [zrzut](docs/design/focus-detail-redesign/after/goal-1440.png) |
| Wiedza | [zrzut](docs/design/focus-detail-redesign/after/knowledge-390.png) | [zrzut](docs/design/focus-detail-redesign/after/real-knowledge-390.png) | [zrzut](docs/design/focus-detail-redesign/after/knowledge-1440.png) |

Makietę i trzy końcowe widoki mobilne obejrzano wspólnie. Sprawdzono szerokości 360, 390, 768 i 1440 px; brak poziomego przepełnienia. [Pomiary DOM](docs/design/focus-detail-redesign/viewport-checks.json) obejmują 360, 768 i 1440 px. Formularz edycji sprawdzono na demo: otwarcie z menu, anulowanie i powrót fokusu. Formularz postępu sprawdzono pod kątem otwarcia i fokusu. Konsola przeglądarki nie zwróciła błędów podczas końcowej kontroli. Dane użytkownika były tylko odczytywane.

## Weryfikacja techniczna i granice

- Pełny zestaw: 55 plików, 341 testów zakończonych powodzeniem.
- Lint, TypeScript i build: zakończone powodzeniem.
- `git diff --check`: bez błędów.
- Ręczna kontrola nie obejmowała wszystkich kombinacji błędów sieciowych ani wszystkich urządzeń. Stany funkcjonalne obejmują także istniejące testy regresji.
- Różne długości tekstu i puste relacje celowo zmieniają wysokość sekcji względem makiety. Nie deklarujemy zgodności piksel w piksel z wygenerowanym obrazem.
- Listy Projektów i ekran szczegółowy Projektu pozostają poza zakresem planu A.

final result: passed

Wynik dotyczy opisanego zakresu układu i zachowanej palety, po dwóch rundach korekt i kontroli na demo oraz danych użytkownika.

---

# Kontrola czytelności listy Działań

Data: 20 września 2026. Zakres: mobilny widok `/actions`, stan „Otwarte”.

## Artefakty porównania

- Source visual truth path: `inline browser capture / cua-repl:shot` — widok sprzed zmian, uchwycony podczas audytu bieżącej aplikacji.
- Implementation screenshot path: `inline browser capture / cua-repl:implShot` — widok po zmianach, uchwycony po hot reloadzie tej samej trasy.
- Zrzuty zostały wyświetlone razem w jednym porównaniu przed/po.
- Oba obrazy: 344 × 844 px, JPEG. Widok CSS: `window.innerWidth` 359 px, `documentElement.clientWidth` 344 px, `window.innerHeight` 881 px, DPR 1.
- Stan: ciemny motyw, dane użytkownika, karta filtrów zamknięta, lista przewinięta do początku.
- Nie wystąpiło poziome przepełnienie dokumentu: `scrollWidth` i `clientWidth` wyniosły 344 px.

## Findings

Brak otwartych problemów P0, P1 lub P2.

- Typografia: zachowano Geist i istniejącą skalę nagłówków. Tytuły kart mają czytelne 15/20 px, tekst pomocniczy został rozjaśniony, a długie tytuły są ograniczone do trzech linii na telefonie.
- Rytm i układ: usunięto stale rozwinięte pola filtrów z pierwszego ekranu. Sekcje „Zaległe”, „Dzisiaj”, „Nadchodzące” i „Bez terminu” porządkują skanowanie bez zmiany kolejności danych w sekcji.
- Kolory i tokeny: zachowano istniejącą granatową paletę i semantyczne kolory statusów. Zaległy termin ma teraz dodatkowy czerwony sygnał tekstowy, więc kolor nie jest jedyną informacją.
- Obrazy i ikony: ekran nie zawiera obrazów produktowych. Użyto istniejących ikon Lucide i nie dodano zastępczych grafik ani niestandardowych SVG.
- Copy: techniczne „17 załadowanych Działań” zastąpiono formą „17 otwartych działań”; kontekst używa spójnego „Projekt:” lub „Cel:”; filtry używają „Wszystkie projekty/cele”.

## Porównanie pełnego widoku

Przed zmianą pola Projekt i Cel zajmowały znaczną część pierwszego ekranu, lista nie miała sekcji, status był reprezentowany samotną ikoną, a termin i kontekst miały słaby kontrast. Po zmianie pierwszy ekran pokazuje liczbę otwartych działań, grupę „Zaległe”, dwie pełne karty oraz początek grupy „Dzisiaj”. Status ma ikonę, nazwę i chevron, a termin zaległy zawiera jawny tekst i datę.

## Porównanie obszarów skupionych

- Filtry: przycisk 44 × 44 px rozwija dwa podpisane selecty, zachowuje ich wartości i pokazuje liczbę aktywnych filtrów.
- Karta: pełny tytuł ma pierwszeństwo szerokości; poniżej znajdują się status, pochodzenie z Rutyny, kontekst i termin.
- Status: kliknięcie tekstowego przycisku otwiera istniejący dialog ze wszystkimi stanami. Dialog został otwarty i zamknięty bez mutowania danych.
- Konsola przeglądarki: brak ostrzeżeń i błędów w końcowym stanie.

## Historia iteracji P0/P1/P2

1. P1 — filtry wypierały listę poza pierwszy ekran. Naprawa: zwijany panel filtrów i aktywne filtry poza panelem. Dowód po zmianie: pierwsza grupa listy zaczyna się nad linią 250 px zrzutu.
2. P1 — status był trudny do rozpoznania bez otwierania kontrolki. Naprawa: tekstowy przycisk statusu z ikoną i chevronem. Dowód po zmianie: „Do zrobienia” jest widoczne na każdej karcie.
3. P2 — widok „Otwarte” wymagał liniowego czytania. Naprawa: grupy według pilności z licznikami. Dowód po zmianie: widoczne nagłówki „Zaległe 2” i „Dzisiaj 2”.
4. P2 — copy i kontrast metadanych utrudniały skanowanie. Naprawa: naturalne polskie etykiety, jaśniejszy tekst pomocniczy i jawne oznaczenie zaległości. Dowód po zmianie: „Projekt: …” oraz „Zaległe · 19 wrz 2026”.

## Weryfikacja techniczna

- Testy listy Działań: 6/6.
- Pozostały zestaw po wyłączeniu znanego, niezwiązanego `src/app/App.test.tsx`: 57 plików, 352 testy — powodzenie.
- `src/app/App.test.tsx` nadal ma wcześniejszą rozbieżność oczekiwania dotyczącą tekstu „Do zrobienia” w widoku Projektu; ta zmiana nie modyfikuje tego widoku.
- TypeScript, ESLint, build produkcyjny i `git diff --check`: powodzenie.
- Sprawdzono rozwinięcie i zamknięcie filtrów oraz otwarcie i zamknięcie dialogu statusu.

## Follow-up polish

- P3: na bardzo wąskim ekranie dalsze zakładki nadal wymagają poziomego gestu; częściowo widoczna kolejna etykieta sygnalizuje możliwość przewijania.

final result: passed

## 2026-10-25 — wspólne dopracowanie wyglądu

Odświeżono granatowo-niebieskie tokeny w `apps/web/src/styles.css`. Warstwa prezentacji `apps/web/src/polish.css` ujednolica powierzchnie, typografię, kontrolki, nawigację oraz odstępy na listach i w formularzach. Kolory stanów pozostają osobną informacją od akcentu nawigacji.

Na telefonie kontekstowe „Dodaj” znajduje się w górnym pasku. Dolna nawigacja ma spokojny przycisk zapisu bez pulsowania. Start zawiera wyraźne wejście do zapisu i kartę powrotu do pracy. Filtry rodzaju Wiedzy przewijają się poziomo na małym ekranie; karty Skrzynki mają własne odstępy i miejsce na akcje. Ekran `/capture` używa tej samej typografii i powierzchni, zachowując przyklejony przycisk zapisu. W szczegółach Działania przyciski kontekstu AI i edycji pozostają czytelne, a podpowiedzi Wiedzy zawijają się bez nakładania.

Kontrola wizualna w lokalnym trybie demo objęła Start, Projekty, Cele, Działania, Rutyny, Bibliotekę, Skrzynkę, Podsumowanie, Ustawienia, szczegóły Projektu/Celu/Działania/Wiedzy, formularz nowego Działania, modal zapisu i pusty wynik wyszukiwania. Rozmiary: 390 × 844 oraz desktop 1440 × 1000; dodatkowo Biblioteka przy szerokości 320 px i zapis przy wysokości 480 px. Przy 480 px przycisk zapisu pozostaje w widocznym obszarze. Konsola bez błędów. To kontrola responsywnego widoku, nie test fizycznej klawiatury iOS.

Dowody: [Start na telefonie](docs/design/polish-2026-10-25/start-mobile.jpg), [Start na desktopie](docs/design/polish-2026-10-25/start-desktop.jpg), [szybki zapis](docs/design/polish-2026-10-25/capture-mobile.jpg), [Biblioteka](docs/design/polish-2026-10-25/knowledge-mobile.jpg). Zmiany są lokalne; bez publikacji na produkcji.

Weryfikacja kodu: typecheck, lint, produkcyjny build demo i `git diff --check` zakończyły się poprawnie. Build nadal sygnalizuje istniejący chunk powyżej 500 kB. Pełny przebieg 531 testów miał 24 niepowodzenia przy wolnym wykonaniu (507 przeszło). Powtórzenie czterech plików pojedynczo dało 119/121; końcowe dwa pliki dały 44/44 po ustawieniu limitu testu SQL na 30 s w poleceniu oraz jawnego oczekiwania 5 s na pierwszy leniwie ładowany widok w teście Celu. Asercje zachowania pozostały bez zmian. Testy wejścia do formularzy wskazują teraz przycisk w nagłówku zamiast usuniętego mobilnego duplikatu w treści.


## 2026-10-27 — nagłówki i pozostałe widoki

Na telefonie usunięto oddzielny pasek z logo; wyszukiwanie i kontekstowe dodawanie są przy tytule strony. Na desktopie globalny pasek zawiera wyszukiwanie i szybki zapis, a dodawanie należy do bieżącego widoku. Błąd synchronizacji nadal ma widoczny komunikat z ponowieniem.

Uproszczono hierarchię kart Projektów i Celów, przeniesiono zapisane widoki Działań do rozwijanego menu, a szczegółowe rodzaje Wiedzy do filtrów. Skrzynka skraca długą treść z możliwością rozwinięcia. Zniknęły powielone statystyki Projektu i Rutyn; liczby znajdują się przy zakładkach lub filtrach. Eksport kontekstu AI przeniesiono do menu szczegółów. Ustawienia mają trzy zwijane sekcje; bezpośredni link `/settings#quick-capture` otwiera instrukcję iPhone.

Kontrola wizualna w lokalnym demo objęła Start, Projekty, Cele, Działania, Wiedzę, Skrzynkę, Rutyny, Podsumowanie, Ustawienia i szczegóły Projektu/Celu/Działania. Sprawdzono mobilne wyszukiwanie, desktopowy szybki zapis, filtr rodzaju Wiedzy, zapisane widoki oraz link do instrukcji iPhone. Rozmiary: 390 × 844 i 1440 × 1000; dodatkowo Podsumowanie, Rutyny i instrukcja ustawień przy 320 px. Poprawiono wykryte przepełnienie paska filtrów Działań i pozycję menu Działania na telefonie. To kontrola responsywnego interfejsu, nie test fizycznego urządzenia iOS.

Weryfikacja: 97 testów w sześciu plikach przeszło; po dodaniu regresji linku do instrukcji iPhone ponowny przebieg `App.regression.test.tsx` przeszedł 59/59 (łącznie 98 różnych testów). Typecheck, lint, build produkcyjny i `git diff --check` poprawne. Build nadal zgłasza ostrzeżenie o istniejącym chunku ponad 500 kB.

Dowody: [Start](docs/design/polish-2026-10-27/start-mobile.png), [Ustawienia](docs/design/polish-2026-10-27/settings-mobile.png), [Skrzynka](docs/design/polish-2026-10-27/inbox-mobile.png), [Projekty na desktopie](docs/design/polish-2026-10-27/projects-desktop.png). Zmiany w lokalnej gałęzi `dev`, bez publikacji na produkcji.

## 2026-10-30 — wybrany wariant A na mobile

Użytkownik wybrał wariant A jako kierunek spójniejszego wyglądu, z priorytetem dla telefonu. Włączono go do właściwych ekranów aplikacji i usunięto tymczasowy przełącznik prototypów A/B/C.

Start i Działania używają wspólnych powierzchni list, delikatnych separatorów, spokojniejszej nawigacji i jednolitej skali odstępów. Data na Starcie poprzedza tytuł. Formularz Działania skupia opcjonalny opis, powiązanie i przypięcie w sekcji „Opis i powiązania”; wybór terminu oraz przycisk zapisu pozostają bezpośrednio dostępne. Zachowano statusy, dowolne daty, obsługę szkiców i błędów oraz kontekstowe dodawanie.

Weryfikacja: 99 różnych testów w sześciu plikach, TypeScript, ESLint i build demo przeszły. Build zgłasza wcześniejsze ostrzeżenia o chunku ponad 500 kB i mieszanych importach repozytorium danych. Kontrola wizualna objęła Start i Działania przy 390 × 844, rozwinięte filtry przy 320 × 700, formularz przy 390 × 844 i 320 × 480 oraz Start na desktopie 1440 × 1000. Filtry przy 320 px nie powodują poziomego przepełnienia. Przy wysokości 480 px dodatkowe pola formularza przewijają się, a zapis pozostaje widoczny. Nie testowano fizycznego iPhone'a ani jego klawiatury.

Podczas końcowej kontroli nieaktywny serwer podglądu spowodował błąd pobrania modułu Działań. Ponowne uruchomienie Vite i przeładowanie strony przywróciły działanie widoku. Zmiany pozostają lokalne, bez publikacji.

Dowody (folder rozpoczęty 29 października): [Start](docs/design/mobile-a-2026-10-29/start-390.png), [Działania](docs/design/mobile-a-2026-10-29/actions-390.png), [Nowe Działanie](docs/design/mobile-a-2026-10-29/new-action-390.png), [formularz 320 × 480](docs/design/mobile-a-2026-10-29/form-320x480.png).

## 2026-11-02 — przegląd ostatnich poprawek wizualnych

Przejrzano wspólną warstwę `polish.css`, zmiany nagłówków i widoków z 27 października oraz mobilny wariant A z 30 października. Obejrzano zapisane zrzuty Działań, krótkiego formularza i Projektów na desktopie.

Poprawiono:

- Menu szczegółów Działania: wyrównanie narzędzi i menu do prawej krawędzi także po zawinięciu nagłówka. Poprzednie otwieranie menu w prawo mogło wypychać je poza szerszy ekran telefonu.
- Zakres selektorów nagłówka i menu: nie zmieniają już przycisków ani rozwijanych sekcji wewnątrz okna eksportu kontekstu AI. Uwzględniono obie kolejności ładowania `polish.css` i `focus-detail.css`.
- „Moje widoki”: usunięto pozostałe po starym panelu marginesy i drugą ramkę; długie nazwy widoków mogą się zawijać, a ich przyciski rosnąć na wysokość.
- Formularz mobilny: lewy i prawy bezpieczny obszar odpowiadają właściwej stronie ekranu, także poniżej 350 px. Przy małej wysokości przywrócono zwarty górny margines.
- Karty Celów: spokojniejszy kolor dotyczy tylko neutralnych etykiet, zachowując wyróżnienie wysokiego priorytetu.

Weryfikacja: pełny przebieg 77 plików / 533 testów, TypeScript i ESLint przeszły. Produkcyjny build demo i `git diff --check` poprawne. Kontrola kaskady w JSDOM, z regułami mediów wybranymi dla szerokości 320, 390, 600, 767, 768 i 1440 px oraz obiema kolejnościami ładowania arkuszy, potwierdziła odseparowanie stylów eksportu AI i reset starego panelu widoków. To kontrola stylów, nie pomiar układu przez silnik przeglądarki.

Ograniczenie: kontrola interfejsu na żywo nie była dostępna — narzędzie zgłosiło wyłączony dostęp do lokalnej przeglądarki w ustawieniach Work i zablokowany Mac. Start lokalnego Vite również zakończył się błędem uprawnień `listen EPERM` dla `127.0.0.1:5173`. Nie wykonano nowych zrzutów ani testu klawiatury iOS. Pozostają wcześniejsze ostrzeżenia buildu o chunku ponad 500 kB i mieszanych importach repozytorium danych. Zmiany są lokalne, bez wdrożenia.

## 2026-11-03 — wspólne formularze tworzenia

Zrealizowano lokalnie [plan ujednolicenia dodawania](docs/planning/2026-11-03-creation-flows-consistency-plan.md): wspólną obudowę, wejścia Działania, pełne formularze Celu/Projektu/Rutyny, Capture i Wiedzę oraz standard pozostałych formularzy. `AppShell` wybiera teraz tę samą implementację niezależnie od breakpointu. Wydzielone pola obsługują harmonogram, książkę, źródło i opcje Celu; triage, rezultat, postęp i łączenie istniejącego obiektu zachowują swoje komendy.

Zachowano zastane zmiany w `polish.css` i `focus-detail.css` — ich diff porównano z kopią sprzed implementacji, wynik identyczny. Dotychczasowa treść tego raportu została zachowana. Obejrzano referencję [Nowe Działanie, wariant A](docs/design/mobile-a-2026-10-29/new-action-390.png). Nowe style są ograniczone do obudowy tworzenia i stopki Capture; nie zmieniają nagłówków szczegółów ani eksportu AI.

### Sprawdzone zachowanie

| Wejście / obszar | Lokalna kontrola |
| --- | --- |
| Globalny Capture, Skrzynka, `/capture` | Wspólny `CaptureComposer`, jedno pole bez klasyfikacji; identyfikator próby i treść zachowane przy błędzie. Skrzynka otwiera panel, a Dodaj nie przełącza formularza. Dotychczasowe klucze Capture pozostają źródłami migracji. |
| Dodaj dowolne i zmiana typu | Wybór bez wymuszania klawiatury, zachowanie tekstu i kontekstów. Szkic innego typu dostaje właściwy klucz; konflikt trafia do odzyskiwania bez nadpisania. |
| Start i lista Działań | Wspólny formularz; Start proponuje dzisiejszy termin bez przypięcia, stary szkic zachowuje wcześniejsze ustawienia. Zmiana daty nie zmienia przypięcia. |
| Cel, inline → panel → inline | Test przy 767 i 768 px zachowuje nazwę, opis, termin, Cel i Projekt, następnie tworzy dwa Działania o różnych identyfikatorach. |
| Lista Celów / Projektów / Rutyn i sekcje Projektu | Testy wejść i zapisów; wspólne pola obejmują szablon, rodzaj i kryteria Celu, kategorię i szablon Projektu oraz pełny harmonogram i checklistę Rutyny. Wybór Celu jest ograniczony do jawnego Projektu. |
| Wiedza, Czytelnia, notatka przy książce | Test tworzenia książki, paginacji nowych notatek i notatki z samej treści, również przy książce w Archiwum. Źródło można wybrać spoza początkowo załadowanej Wiedzy i pobrać kolejne strony książek. Zachowano podpowiedzi istniejących materiałów według URL. Źródło pozostaje odrębne od Projektu i Celu. Wiedza może wskazywać osiągnięty, nadal widoczny Cel. |
| Dodaj materiał przy Działaniu | Test otwarcia rodzaju Materiał i zmiany na Notatkę bez obowiązkowego tytułu. Nowa notatka ma rolę `reference`; Materiał zachowuje `material`. |
| Triage | Wspólne pola Działania, Celu, książki i notatki; osobny trwały szkic wpisu Skrzynki. SQL sprawdza atomowy zapis opcji Celu, zachowanie oryginału, osobne relacje `reference` / `source` i odmowę użycia szablonu z innego Workspace'u. |
| Rezultat, postęp, plan tygodnia, kategorie i własne szablony | Zachowane oddzielne operacje; blokady pól i zapisu, błędy oraz lokalne szkice rezultatu i postępu. Plan tygodnia zachowuje istniejący identyfikator próby. Własny szablon powstaje wyłącznie przez jawną operację ustawień. |
| Szkice i wynik zapisu | Testy dawnych kluczy, konfliktu wersji, błędu storage, izolacji User/Workspace i refetchu. Testy wolnego i podwójnego zapisu, blokady X/Escape/tła/typu, sprzątania po sukcesie i częściowej Rutyny po ponownym otwarciu. |
| Filtry i powrót | Nowe wpisy Biblioteki są scalane z listą bez duplikatów przed jej filtrowaniem. Potwierdzenie udostępnia Otwórz także poza filtrem; test Celu sprawdza pozostanie na liście i jawne otwarcie wyniku. |

### Rozmiary, fokus i ruch — granice dowodu

Testy JSDOM obejmują logikę przy szerokościach 320, 390, 767, 768 i 1440 px, w tym rzeczywiste wejście inline i panel przy obu stronach breakpointu. `Modal.test.tsx` symuluje zmniejszenie visualViewport przy wysokości 480 px, odsłanianie pola, pierwszeństwo ręcznego przewijania i wyłączenie oczekiwania na animację przy reduced motion. Testy istniejących nakładek, wyszukiwania, eksportu AI i edycji pozostają częścią pełnego zestawu.

To testy DOM i zdarzeń, **nie odbiór układu przez silnik przeglądarki ani prawdziwej klawiatury telefonu**. Dostępne narzędzie zgłosiło `Local browser use is disabled in Work settings` i nie udostępniło żadnej przeglądarki. Nie wykonano nowych zrzutów, pomiaru kliknięcie → gotowe pole ani prób na iOS Safari/PWA i Android Chrome. Obie kolejności ładowania CSS sprawdzono pod względem zakresu selektorów w kodzie; ich nowy układ wymaga jeszcze kontroli w przeglądarce. Nie dodano preloadu na podstawie samych czasów JSDOM.

### Kontrakty i publikacja

Potwierdzenie sukcesu jest przechowywane oddzielnie i w szkicu. Retry po potwierdzonym sukcesie służy sprzątaniu, a dla częściowej Rutyny — przygotowaniu wystąpień. Istniejącą idempotencję wykorzystano dla Działania, Capture, notatki i postępu. Nie rozszerzono jej na pozostałe operacje; całkowita utrata lokalnego storage po odpowiedzi serwera nadal ogranicza możliwość odtworzenia potwierdzenia po zamknięciu karty.

Migracja [opcji Celu i relacji notatki w triage](supabase/migrations/20261103200435_creation_triage_goal_options.sql) została sprawdzona w lokalnym PGlite. Nie wdrażano jej do podłączonej bazy. Nowe opcje triage wymagają tej migracji przed użyciem z produkcyjnym backendem. Nie wykonywano publikacji, push ani wdrożenia.

### Końcowe kontrole

- `pnpm lint`: powodzenie, bez ostrzeżeń.
- `pnpm typecheck`: powodzenie.
- `pnpm test`: **77 plików, 556 testów — powodzenie**. Zestaw obejmuje JSDOM, testy domeny i lokalny PGlite.
- `VITE_DATA_BACKEND=demo pnpm build`: powodzenie. Pozostają ostrzeżenia o chunku ponad 500 kB oraz mieszanych importach repozytorium danych.
- `git diff --check`: bez błędów.

Istniejący test SQL przygotowujący 101 użytkowników do obsługi partii 100 przypomnień otrzymał limit 30 s; jego asercje pozostały bez zmian. Test nowego wejścia do leniwie ładowanego Celu czeka do 5 s na pierwszy widok. Nie zmieniono globalnego limitu ani nie pominięto żadnego testu.

Status: implementacja i automatyczna weryfikacja lokalna; odbiór urządzeń pozostaje otwarty.

## 2026-11-04 — identyfikatory szkiców i odrzucone próby zapisu

Poprawiono dwa zgłoszone problemy we wspólnym dodawaniu:

- **P1:** kopiowanie treści między typami nie przenosi już identyfikatora operacji. Nowy szkic dostaje własny UUID, powrót do istniejącego szkicu zachowuje jego klucz, a konflikt i nierozstrzygnięta próba docelowa nie są nadpisywane. Schemat v3 rozdziela również kolidujące klucze niewysłanych szkiców v2. Treść, opcje, potwierdzenia oraz identyfikatory wysłanych prób pozostają zachowane.
- **P2:** repozytorium zachowuje kod błędu RPC. Jednoznacznie odrzucona pierwsza próba Działania lub Notatki odblokowuje pola, zmianę typu, odrzucenie szkicu i zmianę powiązań, z komunikatem pozwalającym poprawić dane. Poprawiona próba ma nowy klucz; stan jest utrwalany przed zamknięciem. Zasada obejmuje również inline w Celu.

Utrata odpowiedzi, brak danych i nierozpoznany kod nadal oznaczają niepotwierdzony wynik: treść oraz klucz pozostają zamrożone po wznowieniu. Późniejsze odrzucenie retry (np. po cofnięciu dostępu) nie dowodzi, że wcześniejsza próba nie została zapisana. Także błąd storage przed retry zachowuje tę blokadę. Potwierdzony sukces i błąd sprzątania nie przechodzą do poprawiania ani ponownego tworzenia obiektu.

Klasyfikacja korzysta z zachowanego SQLSTATE, zgodnie ze strukturą błędów opisaną w [PostgREST](https://docs.postgrest.org/en/stable/references/errors.html) i [PostgreSQL](https://www.postgresql.org/docs/current/errcodes-appendix.html). Nie uznaje samego tekstu błędu transportu ani ogólnej odpowiedzi HTTP za dowód odrzucenia. Rozpoznawanie zwykłych błędów lokalnej walidacji jest ograniczone do jawnej listy kodów domenowych.

Regresje najpierw odtworzyły współdzielenie klucza i trwałą blokadę. Dodano łącznie **21 testów** ponad poprzednie 556: przełączenie Działanie → Notatka → zapis → wznowienie Działania, powrót do własnego klucza, migrację szkiców, poprawianie i odłączenie Celu po wznowieniu, odrzucenie Notatki i formularza inline, rozróżnienie kodów RPC oraz zachowanie niepewnej próby. Test PGlite wykonuje rzeczywiste komendy utworzenia Notatki i Działania, sprawdza oba niezależne audyty i ponowny zapis Działania bez duplikatu ani błędu `actions_pkey`.

Kontrole końcowe:

- `pnpm lint`, `pnpm typecheck`: powodzenie.
- `pnpm test`: **78 plików / 577 testów — powodzenie**.
- `VITE_DATA_BACKEND=demo pnpm build`: powodzenie; wcześniejsze ostrzeżenia o chunku ponad 500 kB i mieszanych importach pozostają.
- `git diff --check`: bez błędów.

Testy formularzy działają w JSDOM, a komendy SQL w lokalnym PGlite. Dostęp do przeglądarki pozostaje wyłączony; nie wykonano nowych zrzutów ani odbioru klawiatury telefonu i płynności animacji. Nie zmieniano zastanych arkuszy `polish.css` i `focus-detail.css`. Nie wykonywano push, publikacji ani wdrożenia, nie dodano nowej migracji SQL.

## 2026-11-04 — ponowny odbiór w działającej przeglądarce

Dostęp do IAB został przywrócony. Sprawdzono rzeczywiste renderowanie przy 320×480, 390×844, 767×700, 768×700 i 1440×900. Na pierwotnej karcie `localhost:5173` sprawdzono Start i dawny szkic, bez tworzenia testowych obiektów w Supabase. Zapisy wykonano na tej samej implementacji w osobnej lokalnej instancji demo. [Macierz wejść i dowody wizualne](docs/design/creation-flows-2026-11-04/README.md) zawierają opis każdej próby; [results.json](docs/design/creation-flows-2026-11-04/results.json) zawiera 46 obserwacji, również stan sprzed poprawek.

Znaleziono i poprawiono trzy problemy:

- **Migracja niewłaściwego typu.** Start → Dodaj Działanie potrafił wznowić dawną Decyzję. Kopia niewysłanego szkicu trafia teraz do właściwego typu przed zastąpieniem jej pustym formularzem. Konflikty są zachowane do odzyskania, bez kolejnych kopii przy każdym wznowieniu. Przy awarii storage pozostaje odczytany formularz; istniejące potwierdzenia i nierozstrzygnięte próby są chronione. Dwa testy najpierw odtworzyły błąd, a ponowna próba na pierwotnej karcie potwierdziła naprawę.
- **Niewidoczny materiał z książki.** Działanie i Cel zapisywały przekazaną książkę, ale nie pokazywały jej w panelu. `CreationMaterialsContext` pokazuje materiał i udostępnia jawne Odłącz. Przycisk jest blokowany w trakcie zapisu, po sukcesie i przy nieznanym wyniku. Sprawdzono na UI zapis relacji `material`; regresje obejmują też odłączenie niedostępnego materiału po odrzuceniu zapisu.
- **Zależność kategorii od lazy formularza.** Przy świeżym wejściu na listę Projektów kolory miały rozmiar 0×0, bo arkusz importował tylko `ProjectCategoryPicker` ładowany wraz z tworzeniem Projektu. Lista i manager importują teraz własny arkusz. Po przeładowaniu bez wcześniejszego otwierania QuickAdd sześć kolorów jest widocznych, klikalnych i ma stabilny rozmiar 28×28 px. Nie zmieniano reguł w `polish.css` ani `focus-detail.css`.

Zapisano i obejrzano Działania, Projekt Standardowy i Czytelnię, kategorię inline oraz pełną kategorię z kolorem i proponowanym szablonem, książkę, notatkę bez tytułu przy książce i Działaniu, Decyzję, Materiał, rezultat, postęp, pełny Cel z kryteriami i pierwszym krokiem, Rutynę z checklistą i polityką zaległości, Capture w panelu/Skrzynce/osobnej stronie, Cel przez triage, własny szablon i krok planu tygodnia. Sprawdzono osobne łączenie istniejącej Wiedzy oraz książki. Formularze wszystkich list i sekcji Projektu przeszły kontrolę przy 390 i 1440 px. Inline → panel zachował nazwę, datę i kontekst przez 767/768 px.

Nowe wpisy pozostawiają miejsce pracy. Materiał wykluczony filtrem Książki dał czytelne potwierdzenie z działającym Otwórz. Sekwencja Działanie → Notatka → wznowienie Działania zachowała treść i dała różne identyfikatory wyników. Rozwinięcie opcji zachowało kursor; 18 przejść Tab pozostało wewnątrz dialogu, Escape zamknął go i przywrócił fokus na przycisk otwierający. Termin i przypięcie sprawdzono jako niezależne.

Granice: viewport przeglądarki nie jest fizyczną klawiaturą telefonu. Nie wykonano odbioru iOS Safari/PWA ani Android Chrome, pomiaru FPS ani wymuszonej odwrotnej kolejności CSS. Wolny zapis, nieznany wynik sieciowy, trwałe odrzucenie, częściowa Rutyna, błąd sprzątania po sukcesie i reduced motion pozostają potwierdzone regresjami JSDOM/PGlite; nie wstrzykiwano ich do przeglądarki. Pojedyncze zmierzone otwarcie Celu (45 ms) obejmuje czas automatyzacji, nie jest benchmarkiem urządzenia. Po zmianie liczby hooków hot reload wymagał pełnego przeładowania pierwotnej karty; późniejsze otwarcie i zachowanie szkicu przeszły kontrolę.

Końcowe kontrole po wszystkich poprawkach:

- `pnpm lint`: powodzenie, bez ostrzeżeń.
- `pnpm typecheck`: powodzenie.
- `pnpm test`: **78 plików / 587 testów — powodzenie** (10 nowych regresji ponad 577 z poprzedniego odbioru).
- `VITE_DATA_BACKEND=demo pnpm build`: powodzenie; wcześniejsze ostrzeżenia o chunku ponad 500 kB i mieszanych importach pozostają.
- `git diff --check`: bez błędów.

Zmiany i dowody pozostają lokalne. Nie wykonywano push ani wdrożenia.
