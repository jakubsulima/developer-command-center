# Plan poprawki „Dodaj” i formularzy mobilnych

Status: propozycja do wdrożenia; bez zmian kodu aplikacji.

Aktualizacja: szczegółowy przegląd bieżącego kodu, pełna macierz wariantów i specyfikacja zmian znajdują się w [2026-09-09-add-complete-audit.md](2026-09-09-add-complete-audit.md). Ten nowszy dokument zastępuje poniższą diagnozę stanu aplikacji.

## Ustalenia

- `AppShell.tsx`: kliknięcie uruchamia `addAction` strony, ale ⌘/Ctrl+J zawsze otwiera globalny `QuickAdd`. Widoczna etykieta pozostaje „Dodaj”, mimo zmieniającego się działania.
- `QuickAdd.tsx`: automatyczny fokus przez `autoFocus`, efekt i zmianę typu; panel pola jest ponownie montowany po zmianie typu. To miejsca wymagające ograniczenia ponownego ustawiania fokusu.
- `Modal.tsx` i `styles.css`: pozycjonowanie względem całego ekranu, limity `100dvh`, przewijanie całego okna. Mobilny QuickAdd ma dodatkowo przyklejoną stopkę z ujemnym `bottom` i wiele nadpisujących się reguł CSS.
- Działania, Cele, Projekty, Rutyny i Wiedza mają różne ścieżki tworzenia. Skrzynka otwiera formularz w stronie; Biblioteka korzysta z okna. Projekt zmienia akcję zależnie od zakładki.
- Globalny QuickAdd i QuickAdd strony Działań używają tego samego klucza szkicu, mimo osobnych instancji. Lista Działań może więc odzyskać inny typ formularza.
- Potwierdzono otwieranie QuickAdd na lokalnym mobilnym widoku Startu i fokus pola. Nie odtworzono rzeczywistej klawiatury iOS/Android; diagnoza zasłaniania wymaga testu na urządzeniu.

## Decyzja produktowa

Zachować przydatny kontekst strony, ale ujednolicić mechanikę. „Dodaj” otwiera jeden panel tworzenia z domyślnym typem i jawnym miejscem zapisu. Nie dodawać obowiązkowego ekranu wyboru przed każdym wpisaniem.

| Miejsce | Domyślny formularz i kontekst |
| --- | --- |
| Start | Działanie, widoczne na Starcie |
| Działania | Działanie bez automatycznej daty i przypięcia |
| Cele | Cel |
| Projekty | Projekt |
| Rutyny | Rutyna |
| Wiedza → Skrzynka | Zapis do Skrzynki |
| Wiedza → Biblioteka | Element Biblioteki |
| Szczegóły Celu | Działanie powiązane z tym Celem |
| Projekt → Cele / Działania / Wiedza | Odpowiedni typ powiązany z Projektem |
| Projekt → Przegląd | Działanie powiązane z Projektem |
| Pozostałe ekrany | Działanie bez powiązania |

Na telefonie zachować krótkie „Dodaj” w nawigacji. Na desktopie pokazać konkretną etykietę, np. „Dodaj Cel”. Nagłówek panelu zawsze nazywa typ. Obok typu dostępne „Zmień”, pokazujące wszystkie opcje: Działanie, Cel, Projekt, Rutyna, Skrzynka, Biblioteka. Kliknięcie i skrót klawiaturowy mają identyczne znaczenie na danej stronie.

Powiązanie, termin i przypięcie są jawne. Zmiana typu zachowuje wpisaną treść, ale nie przenosi niepasujących relacji po cichu. Skrzynka nadal zapisuje surową treść do późniejszego przetworzenia; Biblioteka tworzy uporządkowany element. Przejście do Rutyny odbywa się w tym samym panelu, bez przekierowania i utraty szkicu.

## Układ i klawiatura

1. Telefon: panel zajmuje dostępną wysokość ekranu. Desktop: ograniczone szerokością okno. W obu przypadkach trzy części: stały nagłówek, przewijana treść, stały pasek zapisu.
2. Wysokość i położenie panelu wynikają z faktycznie widocznego obszaru (`visualViewport.height`, `offsetTop`; obsługa `resize` i `scroll`). `100dvh` pozostaje wariantem zapasowym. Nie odejmować ponownie wysokości klawiatury ani zakładać stałych 300 px.
3. Klawiatura może zmniejszyć widoczny obszar bez zmiany obszaru układu, dlatego samo `100dvh` nie stanowi wystarczającej gwarancji. Źródło: [MDN — VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
4. Pasek zapisu jest poza przewijaną treścią, nad klawiaturą. Usunąć ujemne przesunięcia stopki. Uwzględnić safe area bez podwójnego pustego pasa.
5. Aktywne pole, kursor i komunikat błędu muszą być osiągalne w przewijanej treści. Przesuwać treść tylko wtedy, gdy pole jest zasłonięte; nie przewijać całej strony przy każdym wpisanym znaku.
6. Zablokować przewijanie i interakcję tła, zachować pozycję strony, odtworzyć ją i fokus przy zamknięciu. Przy okazji poprawić pułapkę fokusu, aby pomijała ukryte pola zwiniętych sekcji.
7. Na telefonie otworzyć panel bez wymuszania klawiatury; pisanie zaczyna się po dotknięciu pola. Na desktopie ustawić fokus pierwszego pola. Zmiana typu i aktualizacja szkicu nie mogą automatycznie ponawiać fokusu ani gubić kursora.
8. Pola co najmniej 16 px, cele dotykowe co najmniej 44 px, brak blokowania zoomu. Przy małej wysokości ograniczyć dekoracje i odstępy; zachować dostępność pól i zapisu.

## Uproszczenie formularzy

- Pierwszy widok: nazwa/treść, krótki opis miejsca zapisu, istotne opcje oraz przycisk zapisu. Usunąć rozbudowane intro i opisy powtarzające etykiety.
- Działanie: osobna nazwa i opcjonalny opis; termin i powiązanie dostępne w „Szczegółach”, z podsumowaniem przy zwinięciu. Nie uzależniać tytułu od pierwszej linii bez jasnego oznaczenia.
- Cel: nazwa i rezultat, opcjonalny Projekt. Projekt: nazwa i opcjonalny opis. Zachować wymagania istniejących komend.
- Rutyna i Biblioteka zachowują swoje wymagane pola, ale używają wspólnego układu. Cykliczność nie staje się ukrytym efektem zwykłego Działania.
- „Bez terminu” usuwa datę; przypięcie do Startu jest osobnym, widocznym ustawieniem. „Dzisiaj” i „Jutro” mają wspólnie zdefiniowane zachowanie we wszystkich formularzach.
- Szkice rozdzielić według typu i kontekstu oraz użytkownika/workspace. Odzyskany szkic oznaczyć; nie zastępować nim po cichu innego kontekstu. Zachować zgodność z istniejącymi szkicami przez jawne odzyskanie starego QuickAdd.
- Po sukcesie zamknąć panel, wyczyścić tylko zapisany szkic, pokazać potwierdzenie z „Otwórz”. Pozostać na bieżącej stronie. Jeśli filtr ukrywa wynik, komunikat wyjaśnia miejsce zapisu.
- Przy błędzie zachować treść i umożliwić ponowienie. Podczas zapisu blokować ponowne wysłanie oraz zmianę typu; operacja ma korzystać z uchwyconych danych formularza.

## Kolejność wdrożenia

1. Wspólny układ formularza i obsługa widocznego obszaru w `Modal.tsx` / nowym komponencie formularza; uporządkowanie powiązanych reguł w `styles.css`. Najpierw podłączyć QuickAdd i sprawdzić klawiatury.
2. Jeden właściciel panelu i jawny opis żądania tworzenia w `AppShell.tsx` (typ, kontekst, domyślne ustawienia). Ujednolicić kliknięcie oraz ⌘/Ctrl+J; usunąć drugą instancję QuickAdd w `ActionsPage.tsx`.
3. Podłączyć formularze Celów, Projektów, Rutyn, Biblioteki i Skrzynki oraz szczegóły Projektu/Celu. Współdzielić formularze, zachowując istniejące komendy domenowe. Migracja ekranu po ekranie, bez zmiany modelu danych.
4. Ujednolicić szkice, terminy, błędy i potwierdzenia. Zaktualizować testy regresyjne oraz opisy funkcji w dokumentacji.

## Warunki odbioru

- Safari na rzeczywistym iPhonie i Chrome na rzeczywistym Androidzie: otwarcie klawiatury, zmiana pola, wybór daty, długi tekst, rozwinięcie szczegółów, zamknięcie klawiatury i obrót telefonu. Tryb standalone, jeśli aplikacja jest w nim używana.
- Szerokości 320, 390 i 430 px oraz niska wysokość/pozioma orientacja: brak poziomego przewijania; nagłówek i zapis dostępne; pole z kursorem nie przykryte stopką ani klawiaturą; brak pustego pasa po zamknięciu klawiatury.
- Każdy wiersz tabeli: poprawny typ, kontekst i wynik zapisu; to samo przez kliknięcie i skrót. Zmiana typu, przejście między stronami i odzyskanie szkicu nie przenoszą obcych relacji.
- Błąd zapisu, ponowienie i wielokrotne naciśnięcie przycisku: brak utraty treści i przypadkowych duplikatów. Zamknięcie bez zapisu zachowuje szkic.
- Testy komponentów: zdarzenia visualViewport i sprzątanie listenerów, fokus/Tab/Escape, domyślne konteksty, szkice i blokada zapisu. Regresja pozostałych użytkowników `Modal`, zwłaszcza wyszukiwania i potwierdzeń.
- Emulacja małego ekranu i symulowane zdarzenia viewportu uzupełniają testy; nie zastępują próby z prawdziwą klawiaturą.
