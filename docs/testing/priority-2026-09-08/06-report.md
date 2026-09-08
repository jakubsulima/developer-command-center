# Raport 06 — zaległości i blokady

Data: 8 września 2026  
Baza kodu: `2d71f97fd8827d5cb32eaedadac183471af34904` oraz bieżące, niecommitowane zmiany planu 06.

## Implementacja lokalna

Plan 02 i plan 05 zostały sprawdzone przed rozpoczęciem prac. Ich raporty wskazują stan lokalnie gotowy, z odbiorem stagingowym oczekującym; lista Działań z planu 05 i istniejący kontrakt Workspace są użyte jako baza.

Zrealizowano:

- Start i Przegląd tygodniowy prowadzą do `/actions?view=overdue` lub `/actions?view=blocked`; przy pojedynczym wskazaniu przekazują `highlight=<id>`.
- Lista odnajduje wyróżnione Działanie także poza pierwszą stroną paginacji, zachowuje filtry i nie duplikuje pozycji.
- Wiersz otwartego Działania ma menu: Ukończ, Dzisiaj, Jutro, Wybierz datę, Bez terminu i Anuluj. Działanie z blokadą pokazuje powód oraz Odblokuj.
- Przełożenie zmienia wyłącznie `scheduledFor`; przypięcie na dziś zostaje jawne i jest komunikowane. Anulowanie zmienia status, ale zachowuje rekord.
- Ukończenie korzysta z istniejącej walidacji domeny, a zmiany są wykonywane pojedynczo przez istniejące komendy i koordynator mutacji. Dla wystąpienia rutyny nie jest zmieniany szablon ani przyszłe rekordy.
- Statusy i daty mają blokadę powtórnego kliknięcia, loading, błąd oraz retry. Undo przywraca poprzedni status, blocker lub datę, a przy błędzie można ponowić cofnięcie. Konflikt wersji ma komunikat dla użytkownika i odświeżenie kolejki; rollback usuwa również optymistyczny wpis blokady.
- Po usunięciu wiersza fokus przechodzi na sąsiednie Działanie albo pusty stan. Undo przywraca element i ponownie kieruje fokus na jego wiersz.
- Puste widoki mają osobne komunikaty dla zaległych i zablokowanych Działań oraz przejście do otwartych.
- Dodano addytywną, lokalną migrację wersjonowanego `set_action_status_checked`; nie została wdrożona zdalnie.

### Testy i kontrole

- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm test` — standardowe uruchomienie równoległe nie przechodziło, bo środowisko Node 20.10.0 powodowało timeouty na ekranie ładowania. Pełny Vitest uruchomiony na bundlowanym Node 24 z `--maxWorkers=1`: **53 pliki, 299 testów — PASS**.
- Testy celowane planu 06 na Node 24: **7 plików, 71 testów — PASS**; końcowa regresja Actions/feedback: **2 pliki, 11 testów — PASS**.
- `VITE_DATA_BACKEND=demo pnpm build` — PASS.
- `pnpm check:bundle` — PASS; CSS 35 839 B gzip przy limicie 35 840 B.
- `git diff --check` — PASS.
- Przegląd lokalnego UI w przeglądarce — desktop PASS: bezpośrednie `/actions?view=overdue` otwiera kolejkę, widoczne są trzy Działania i menu pojedynczego wiersza z decyzjami. Tryb demo uruchomiono przez `VITE_DATA_BACKEND=demo`.

## Staging

Nie wykonano odbioru na realnym koncie ani zdalnej migracji. Do weryfikacji pozostają: rzeczywisty RPC wersjonowanego statusu, izolacja Workspace na stagingu oraz przepływ od linku Start/Przegląd do kolejki po wdrożeniu migracji.

## Produkcja

Nie wdrażano produkcji.

## Odstępstwa i brakujące dowody

Nie wykonano osobnego przeglądu w rozmiarze 390×844, z pełnym przepływem klawiatury, długimi tekstami oraz stanami loading/error. Testy RTL i build nie zastępują tego odbioru. Plan pozostaje więc oznaczony jako „lokalnie gotowy, staging oczekuje”.
