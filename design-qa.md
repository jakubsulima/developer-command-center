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
