# Raport 01 — wiarygodne wyniki wyszukiwania

Data: 8 września 2026
Status: **lokalnie gotowy, staging oczekuje**

## Baza kodu

- Gałąź: `styling/UI/UX-improvments`
- HEAD przed realizacją: `5bf7172`
- Katalog roboczy był zmodyfikowany przed rozpoczęciem zadania. Zachowano zastane zmiany użytkownika, w tym częściową implementację wyszukiwania, CSS, manifest pakietu, lockfile i dokumentację.
- Zakres nie zmienia backendu, schematu danych ani migracji.

## Zakres i implementacja lokalna

Zaimplementowany komponent wyszukiwania rozróżnia puste pole, frazę krótszą niż dwa znaki, oczekiwanie/szukanie, sukces z wynikami, sukces bez wyników i błąd. Zachowano debounce 200 ms oraz limit 20 wyników.

Awaria pokazuje komunikat „Nie udało się wyszukać. Spróbuj ponownie.” i przycisk „Ponów”. Retry zachowuje frazę, uruchamia nowe żądanie i blokuje duplikowanie próby w trakcie żądania. Wyniki i błędy starszej frazy są unieważniane po zmianie frazy, zamknięciu widoku, ukryciu mobilnego modalu, zmianie funkcji wyszukiwania związanej z kontekstem konta oraz odmontowaniu komponentu.

Lista wyników zachowuje obsługę strzałek, Enter i Escape. Komunikaty loading/empty/error pozostają poza `listbox`; `aria-activedescendant` jest ustawiane tylko dla istniejącej opcji. Mobilny modal przekazuje do komponentu jawny stan widoczności, dzięki czemu odpowiedź po zamknięciu nie wraca do interfejsu.

Pliki objęte wynikiem zadania:

- `apps/web/src/components/GlobalSearch.tsx`
- `apps/web/src/components/GlobalSearch.test.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/app/App.regression.test.tsx`
- `docs/planning/priority-implementation-2026-09-08/README.md`
- `docs/testing/priority-2026-09-08/01-report.md`

## Testy automatyczne

| Kontrola | Wynik | Dowód |
| --- | --- | --- |
| Testy celowane | PASS | `pnpm --filter @command/web exec vitest run src/components/GlobalSearch.test.tsx src/app/App.regression.test.tsx` — 2 pliki, 44 testy |
| Lint | PASS | `pnpm lint` |
| Typy | PASS | `pnpm typecheck` |
| Pełne testy | PASS | `pnpm test` — 50 plików, 264 testy |
| Build demo | PASS | `VITE_DATA_BACKEND=demo pnpm build` |
| Budżet bundla | PASS | `pnpm check:bundle` |

Pierwsze pomocnicze uruchomienie testów z argumentami przekazanymi po `--` wykonało cały zestaw i miało jeden czasowy błąd istniejącego testu `App.test.tsx` podczas ładowania lazy route. Precyzyjne testy celowane oraz późniejsze wymagane `pnpm test` przeszły w całości; nie zmieniano kodu, aby ukryć ten incydent.

Testy komponentu z kontrolowanymi odpowiedziami API wyszukiwania obejmują resolve/reject, retry bez zwielokrotnienia żądań, spóźniony sukces i spóźniony błąd, zamknięcie/ukrycie/odmontowanie, zmianę kontekstu konta oraz klawiaturę. Regresja aplikacji obejmuje nagłówek desktopowy i mobilny modal, w tym krótką frazę, Escape, ponowne otwarcie i zamknięcie po wyborze wyniku.

## Weryfikacja w przeglądarce

Lokalny serwer: `VITE_DATA_BACKEND=demo pnpm --filter @command/web exec vite --host 127.0.0.1`.

| Scenariusz | Desktop 1280×720 | Mobile 390×844 |
| --- | --- | --- |
| Strona ma treść i brak nakładki błędu | PASS | PASS |
| Błędy konsoli | 0 | 0 |
| Poziomy overflow dokumentu | brak | brak |
| Jeden znak | „Wpisz co najmniej 2 znaki” | „Wpisz co najmniej 2 znaki” |
| Długa fraza bez trafień | „Brak wyników” | układ mieści długi tekst; empty potwierdzony na desktopie i testem komponentu |
| Loading | widoczny | widoczny |
| Wyniki | 4 wyniki dla `budżet` | 4 wyniki dla `budżet` |
| Klawiatura | strzałka zmienia wybór, Enter nawiguje, Escape czyści i zamyka | strzałka/Enter zamykają modal po wyborze, Escape zamyka modal |

Stan błędu i retry nie został sztucznie wywołany w ręcznej sesji demo, ponieważ adapter demo nie ma przełącznika awarii. Został zweryfikowany w przeglądarkowym środowisku JSDOM kontrolowanym odrzuceniem Promise: rozłączny komunikat błędu, brak surowej diagnostyki i `listbox`, zachowanie frazy, pojedyncze ponowienie oraz sukces po retry.

## Kryteria odbioru

- [x] Puste pole nie generuje żądania; jeden znak nie pokazuje „Brak wyników”.
- [x] Poprawne zero trafień i odrzucone żądanie dają różne komunikaty.
- [x] Błąd → Ponów → sukces bez utraty frazy; wielokrotne kliknięcie nie mnoży żądań.
- [x] Opóźnione odpowiedzi dwóch różnych fraz nie zamieniają wyników.
- [x] Strzałki, Enter, Escape i mobilne zamknięcie działają; aktywna opcja zawsze istnieje.

## Staging

Nie weryfikowano. Plan 01 nie zmienia backendu, ale odbiór na prawdziwym koncie pozostaje częścią planu 09. Brak dostępu lub zlecenia wdrożenia nie został oznaczony jako PASS.

## Produkcja

Nie wdrażano i nie weryfikowano. Nie wykonano zdalnych migracji, `migration repair`, publikacji ani commita.

## Odstępstwa i brakujące kryteria

- Brak ręcznego wymuszenia awarii adaptera w sesji demo; pełny scenariusz błędu/retry pokrywa test kontrolowany.
- Brak weryfikacji stagingu i produkcji. Lokalna implementacja planu 01 jest kompletna, ale status pozostaje pośredni zgodnie z zasadami pakietu.
