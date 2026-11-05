# Odbiór dodawania w przeglądarce — 4 listopada 2026

Próby wykonano na żywym UI w przeglądarce IAB. Bieżąca karta
`localhost:5173` korzystała z Supabase; sprawdzono na niej wznowienie szkicu
Startu, bez tworzenia danych testowych w tej bazie. Zapisy i pozostałą macierz
wykonano na tym samym kodzie w lokalnym demo `127.0.0.1:5174`.
Dane oznaczono prefiksem `QA`. Nie wdrażano migracji ani aplikacji.

## Znalezione i poprawione

1. Start otwierał dawną Decyzję zamiast Działania. Niewysłany szkic innego
   typu jest kopiowany do właściwego zakresu przed udostępnieniem pustego
   formularza. Konflikt trafia do odzyskiwania, kopie nie mnożą się przy
   wznowieniu. Awaria kopii zachowuje odczytany formularz. Wysłane próby i
   potwierdzenia nie są przekierowywane.
   [Przed](start-wrong-restored-type-before.jpg),
   [po na pierwotnej karcie](start-restored-type-after.jpg).
2. Działanie i Cel otwierane z książki zapisywały materiał, ale nie pokazywały
   go w formularzu. Nazwa jest teraz widoczna, materiał można jawnie odłączyć;
   przy zapisie i niepotwierdzonej próbie przycisk pozostaje zablokowany.
   [Działanie przed](book-action-context-before.jpg),
   [Działanie po](book-action-context-after-390.jpg),
   [Cel po](book-goal-context-after-390.jpg).
3. Świeże wejście na Projekty → Kategorie nie ładowało arkusza kategorii.
   Wszystkie sześć przycisków kolorów miało rozmiar 0×0. Lista i manager
   importują teraz swój arkusz bezpośrednio. Po świeżym wejściu kontrolki
   są widoczne, klikalne i po zakończeniu animacji mają 28×28 px.
   [Przed](category-colors-before.jpg), [po](category-colors-after.jpg).

## Sprawdzone wejścia i wyniki

| Wejście | Dowód / wynik |
| --- | --- |
| Start → Działanie | Zapis pozostawia Start, Otwórz działa poza bieżącym widokiem. Jutro nie włącza przypięcia. Rozwinięcie opisu zachowało pozycję kursora 1. [320×480](action-320x480.jpg), [390×844](action-390x844.jpg), [767](action-767x700.jpg), [768](action-768x700.jpg), [1440](action-1440x900.jpg). |
| Listy Działań, Celów, Projektów, Rutyn i Wiedzy | Każdy przycisk otwiera właściwy formularz przy 390 i 1440 px. Wyniki w `results.json`. |
| Więcej → Dodaj dowolne | Najpierw sześć typów; brak pól edytowalnych i brak fokusu w polu tekstowym. |
| Projekt Standardowy → Przegląd / Cele / Działania / Wiedza | Przegląd pokazuje wybór typu z Projektem. Pozostałe sekcje otwierają właściwy typ z widocznym Projektem przy 390 i 1440 px. [Cel](project-goal-390.jpg), [Działanie](project-action-390.jpg), [Wiedza](project-knowledge-390.jpg). |
| Projekt → kategorie i szablon | Zapisano Standardowy i Czytelnię, kategorię inline oraz kategorię z kolorem i propozycją szablonu. Jawny filtr nowej kategorii proponuje ją i Czytelnię w nowym Projekcie. [Formularz](project-reading-390.jpg), [kategoria](project-category-320x480.jpg), [filtr](project-filter-defaults.jpg). |
| Czytelnia → nowa / istniejąca książka | Zapisano autora i status W trakcie. Dołączono istniejącą książkę z Biblioteki bez tworzenia drugiego obiektu. [Książka](book-project-390.jpg). |
| Książka → notatka / Działanie / Cel | Notatka bez tytułu zachowała dwie linie oraz relację źródła. Działanie zapisało książkę jako Materiał; Cel zachował książkę, kryteria i pierwszy krok. [Notatka](book-note-320x480.jpg), [Działanie](book-action-context-after-390.jpg), [Cel](book-goal-context-after-390.jpg). |
| Cel → inline → panel | Nazwa, termin 6 listopada, Cel i Projekt przeszły do panelu przez 767/768 px. Po zapisie pole inline jest puste, Działanie pozostaje w tym Celu. Natywne pole daty zatwierdzono klawiaturą; samo narzędziowe fill nie wystarczało do wywołania zmiany. [Panel](inline-shared-768.jpg). |
| Działanie → Dodaj materiał / Nowa | Domyślnie Materiał. Kliknięcie widocznej etykiety Notatka zmienia rodzaj; zapis bez tytułu daje relację reference. Połącz istniejącą Wiedzę zachowuje oddzielną operację. [Notatka](action-note-390.jpg). |
| Działanie → rezultat | Zapisano nowy kanoniczny Rezultat; Działanie nadal ma status Do zrobienia. [Formularz](action-result-390.jpg). |
| Cel → postęp | Zapis podniósł licznik historii, pozostał w Celu i pokazał potwierdzenie. |
| Rutyna | Zapisano środę, dwa punkty checklisty, Cel i politykę jednego zaległego. Brak dni powoduje czytelny błąd. Jedna przewijana treść i osiągalny zapis przy [320](routine-320.jpg), [390](routine-390.jpg), [767](routine-767.jpg), [768](routine-768.jpg), [1440](routine-1440.jpg). |
| Globalny Capture, ⌘J, Skrzynka, /capture | Jedno pole, tekst lub link bez klasyfikacji. Skrót otwiera ten sam Capture; Escape go zamyka. Zapis nie zmienia miejsca pracy. Osobna strona udostępnia Otwórz zapis, Uporządkuj i Zapisz kolejną myśl. [Panel](capture-320.jpg), [strona](capture-page-320x480.jpg). |
| Skrzynka → triage | Otworzono Działanie i Notatkę, następnie zapisano Cel z rodzajem Nauka, kryterium i pierwszym krokiem. Oryginalny tekst pozostał w Przetworzonych. [Cel](triage-goal-320x480.jpg). |
| Biblioteka → Decyzja / Materiał | Zapisano Decyzję z uzasadnieniem. Materiał odrzucił URL bez protokołu. Po poprawie zapis poza filtrem Książki udostępnił działające Otwórz. |
| Działanie → Biblioteka → Notatka → wznowienie Działania | Zapisano Notatkę, a potem wznowione Działanie z tą samą treścią. Widoczne adresy wyników mają różne identyfikatory; wynik w `results.json`. |
| Własne szablony Celów | Zapisano szablon Nauka z pierwszym krokiem; można go wybrać w pełnym formularzu Celu. [Szablon](goal-template-390.jpg). |
| Podsumowanie → Plan → krok | Zapisano krok dla Celu na poniedziałek 9 listopada. Agenda pokazuje wybrany dzień; przy 320 px brak poziomego overflow. [Formularz](weekly-plan-320x480.jpg). |
| Fokus i zamknięcie | 18 kolejnych przejść Tab nie opuściło dialogu; Escape zamknął go i przywrócił fokus na przycisk dodawania. |

## Granice dowodu

- Rozmiary to rzeczywiste renderowanie przeglądarki przy zadanym viewport,
  bez emulacji fizycznej klawiatury iOS Safari/PWA lub Android Chrome.
- `results.json` zawiera 46 obserwacji, w tym pomiary sprzed poprawki.
  Pomiary wykonane tuż po otwarciu mogą obejmować transformację wejścia;
  zapisano też stabilny pomiar kolorów po animacji. Zrzuty nie są pomiarem FPS.
- Jedna próba otwarcia Celu zajęła 45 ms według zegara narzędzia; obejmuje
  ona komunikację automatyzacji i nie jest miarą wydajności urządzenia.
- Wolny zapis, nieznany wynik sieciowy, trwałe odrzucenie, częściowy sukces
  Rutyny, błąd storage po sukcesie i reduced motion pozostają sprawdzone
  automatycznie w JSDOM / PGlite. W tej próbie nie wstrzykiwano ich do
  przeglądarki i nie zmieniano ustawień systemowych.
- Obejrzano układ po wielu przejściach między listami i szczegółami oraz
  świeże ładowanie. Nie wymuszano ręcznie odwróconej kolejności arkuszy CSS.
- Podczas dodania hooka hot reload zgłosił zmianę kolejności hooków w
  istniejącej karcie. Pełne przeładowanie przywróciło aplikację; dalsze
  otwarcie formularza i zachowanie szkicu zostały potwierdzone.

Pełne kontrole i status: [design-qa.md](../../../design-qa.md).
