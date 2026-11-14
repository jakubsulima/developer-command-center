# Odbiór pierwszego wydania widoku Projektu

Data: 14 listopada 2026. Status: implementacja i odbiór lokalny zakończone.
Zakres: [pierwsze wydanie planu](../../planning/2026-11-14-project-workspace-and-action-groups-plan.md).

## Wprowadzone zmiany

- Nagłówkowe Dodaj w Projekcie otwiera zakotwiczone menu: Działanie, Cel,
  Notatka, Materiał i Decyzja, a w Czytelni również Książka. Bezpośrednie
  przyciski w sekcjach i panelach otwierają formularz wybranego typu.
- Opis/rezultat/uzasadnienie jest widoczne bezpośrednio pod nazwą. Pole
  dopasowuje wysokość do treści do 240 px, potem przewija własną zawartość.
  Powiązania i dodatkowe ustawienia Działania mają osobne rozwinięcie.
  Krótka Notatka i Szybki zapis zachowują dotychczasowy model treści.
- Przegląd pokazuje pełną filtrowaną listę Działań, do pięciu bieżących
  Celów i sześciu wpisów Wiedzy. Każdy panel pozwala dodawać, a pełne
  sekcje pozostają dostępne z zachowaniem filtrów w adresie.
- Dwie kolumny wymagają desktopu od 1200 px i co najmniej 820 px treści.
  Przy 1360 px treści panele rozkładają się na trzy kolumny. Na węższych
  ekranach pozostaje jeden widok z zakładkami.
- Menu obsługuje strzałki, Home/End, Escape, Tab i kliknięcie poza.
  Fokus wraca do trwałego przycisku także po pierwszym otwarciu formularza,
  gdy moduł musi dopiero zostać pobrany.

## Przyczyny migania i testy regresji

| Potwierdzony problem | Poprawka | Dowód |
| --- | --- | --- |
| Po dodaniu powiązania nowy klucz zapytania Wiedzy usuwał wcześniej pobrane rekordy z widoku do czasu nowej odpowiedzi | Zachowanie ostatniego udanego odczytu wyłącznie w tym samym trybie, Workspace i Projekcie; bieżące relacje filtrują tę listę, lokalne wpisy mają pierwszeństwo | Test przed poprawką otrzymywał tylko nowy wpis zamiast nowego i wcześniej wczytanego. Po poprawce przechodzi również opóźnienie, błąd i zmiana kontekstu. |
| Zmiana statusu w globalnej liście Działań resetowała query do pustego stanu | Odświeżanie w tle przez unieważnienie, bez resetu danych | Test zachowuje ten sam wiersz DOM i sprawdza, że odświeżanie nie przechodzi przez pusty stan pending. |
| Nowe Działanie nie wchodziło do globalnej listy do czasu kolejnego odczytu strony | Potwierdzone utworzenie dodaje wpis do widoku przez zdarzenie tworzenia, z deduplikacją i zachowaniem filtrów | Test przed poprawką nie znajdował nowego wpisu; po poprawce wiersz jest dostępny od razu, a poprzedni pozostaje zamontowany. |

Nie wyłączono synchronizacji ani ochrony przed spóźnionymi odczytami.
Regresje koordynatora mutacji, odświeżania i szkiców przechodzą w pełnym zestawie.

## Odbiór w przeglądarce

Zapis i wznowienie sprawdzono w osobnym lokalnym demo. Potwierdzono wpisanie
dwóch linii opisu bez rozwijania, zapis Działania w Projekcie, natychmiastową
obecność na pulpicie, treść w szczególe oraz powrót z filtrem Bez terminu.
Sprawdzono wybór Decyzji i zachowanie Czytelni, fokus po zimnym otwarciu
panelu oraz szkic po zamknięciu, ponownym otwarciu i zmianie rozmiaru okna.
Roboczą kartę z backendem sprawdzono bez tworzenia lub zmieniania rekordów.

| Viewport | Układ | Poziomy overflow |
| --- | --- | --- |
| 320, 390, 768 i 1024 px | Zakładki i pojedynczy widok | Brak |
| 1200 i 1440 px | Działania oraz kolumna Celów i Wiedzy | Brak |
| 1920 px | Osobne kolumny Działań, Celów i Wiedzy | Brak |

[Pomiary responsywności](./responsive-check.json) zawierają szerokość treści,
kolumny i sposób nawigacji. Przy 320 × 480 px formularz miał przewijaną
treść o wysokości 348 px i stopkę w zakresie 408–480 px, bez poziomego overflow.

Zrzuty: [1920 px](./project-1920.jpg), [1440 px](./project-1440.jpg),
[menu desktopowe](./project-add-menu.jpg), [menu 390 px](./menu-390.jpg),
[formularz 390 px](./action-390.jpg), [formularz 320 × 480 px](./action-320x480.jpg).

## Kontrole automatyczne i granice odbioru

- `pnpm lint` — poprawnie.
- `pnpm typecheck` — poprawnie, wraz z pakietem kontekstu AI.
- `pnpm test` — 83 pliki, 638 testów, wszystkie poprawne.
- `VITE_DATA_BACKEND=demo pnpm build` — poprawnie, wraz z PWA.
- `git diff --check` — bez błędów.

Opóźnienia i błędy odczytu backendu sprawdzono w deterministycznych testach
z kontrolowaną odpowiedzią. Nie wykonywano zapisu testowego w zdalnym
Workspace ani wdrożenia produkcyjnego. Odbiór fizycznego telefonu
z klawiaturą systemową, powiększenia przeglądarki do 200% oraz nagranie
FPS pozostają poza wykonanymi próbami; mały viewport nie zastępuje telefonu.
Nie zmieniano modelu Celów, schematu danych ani statusów zgłoszeń w Command.
