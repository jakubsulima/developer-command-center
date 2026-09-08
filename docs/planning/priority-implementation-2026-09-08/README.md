# Najważniejsze wdrożenia — zadania do przekazania czatowi

Data: 8 września 2026. Status początkowy wszystkich planów: **do realizacji**; bieżące statusy są zapisane poniżej.
Źródło zakresu: [audyt produktu](../product-roadmap-audit-2026-09-07.md).

Pakiet obejmuje wszystkie pozycje P1 audytu oraz U06 (język), potrzebne do zamknięcia pierwszego pakietu. Każdy plan jest osobnym zadaniem implementacyjnym. Czytaj go razem z zasadami poniżej; nie trzeba przekazywać historii rozmowy. Podane zachowania są proponowaną specyfikacją do realizacji po zleceniu danego planu.

## Kolejność i zakres

| Kolejność | Plan | Pozycje audytu | Warunek startu | Rezultat |
| --- | --- | --- | --- | --- |
| 1 | [01 — Wyszukiwanie](./01-search-feedback.md) | F03 | Brak | Błąd nie udaje braku wyników. |
| 2 | [02 — Podsumowanie i język](./02-summary-and-language.md) | F05, U06 | Brak | Bieżąca domena i czytelne polskie komunikaty. |
| 3 | [03 — Ochrona treści](./03-persistent-drafts.md) | F04 | Brak | Przerwa nie usuwa niezapisanej pracy. |
| 4 | [04 — Czytelność na telefonie](./04-mobile-clarity.md) | U01, U02, U03 | 02 i 03, żeby nie przebudowywać ponownie tych samych formularzy | Kontekst Działania i wygodny szczegół Celu. |
| 5 | [05 — Wszystkie Działania](./05-actions-list.md) | F01 | 04 jako baza wyglądu | Jedna kompletna lista z filtrami i paginacją. |
| 6 | [06 — Zaległości i blokady](./06-backlog-decisions.md) | F02 | 05, 02 | Decyzje z listy, właściwe linki, undo. |
| 7 | [07 — Aktualność danych](./07-data-freshness.md) | F06 | 03; po 05/06 obejmuje też nową listę | Bezpieczny powrót z telefonu na komputer. |
| 8, opcjonalnie | [08 — Capture offline](./08-offline-capture.md) | F07 | 03 i 07 | Trwała kolejka tekstu/linków do Skrzynki. |
| 9 | [09 — Odbiór na realnym koncie](./09-staging-acceptance.md) | Q01 | Implementacja wybranego pakietu | Raport rzeczywistego przepływu i gotowości wydania. |

## Status realizacji

- 01 — **lokalnie gotowy, staging oczekuje** — [raport 01](../../testing/priority-2026-09-08/01-report.md)
- 02 — **lokalnie gotowy, staging oczekuje** — [raport 02](../../testing/priority-2026-09-08/02-report.md)
- 03 — **lokalnie gotowy, staging oczekuje** — [raport 03](../../testing/priority-2026-09-08/03-report.md)
- 04 — **lokalnie gotowy, staging oczekuje** — [raport 04](../../testing/priority-2026-09-08/04-report.md)
- 05 — **lokalnie gotowy, staging oczekuje** — [raport 05](../../testing/priority-2026-09-08/05-report.md)
- 06 — **lokalnie gotowy, staging oczekuje** — [raport 06](../../testing/priority-2026-09-08/06-report.md)

Przed pierwszą zmianą backendu wykonaj przygotowawczy, tylko do odczytu etap planu 09. Końcowe E2E wykonaj po gotowym pakiecie. Plan 08 można pominąć, jawnie wpisując to do zakresu wydania. Pozostałe zależne plany otrzymują kod i raport poprzednika; sam plik planu nie oznacza wykonania zależności.

Domyślnie przekazuj **jeden plan naraz**, w tym samym projekcie, po włączeniu zmian poprzednika do używanego katalogu roboczego. Nie uruchamiaj kilku czatów edytujących równocześnie wspólny `styles.css`, store i kontrakty repozytorium.

## Gotowe polecenie — cały pakiet dla jednego czatu

```text
Zrealizuj kolejno plany 01–07 i 09 z katalogu:
/Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/

Zacznij od README.md i przestrzegaj zależności. Plan 08 (offline) pomiń w tym pakiecie.
Najpierw sprawdź bieżący kod i zastane zmiany. Implementuj kompletne przepływy,
uruchamiaj wymagane kontrole i zapisuj raport odbioru po każdym planie.
Podejmuj rutynowe decyzje samodzielnie w granicach specyfikacji; nie poprzestawaj
na ponownym planowaniu. Nie cofaj cudzych zmian. Nie wdrażaj zdalnych migracji,
nie naprawiaj zdalnej historii migracji, nie publikuj produkcji i nie twórz
commitów bez osobnego zlecenia. Jeśli brakuje dostępu do stagingu, wykonaj
dostępne prace lokalne i wskaż konkretnie niezweryfikowane kryteria.
Rozróżniaj implementację lokalną, weryfikację staging i wdrożenie produkcyjne.
```

Każdy plik poniżej zawiera również gotowe polecenie dla pojedynczego zadania. Aby dołączyć offline do całego pakietu, zmień zakres powyżej na „01–09, włącznie z 08”.

## Zasady wspólne dla wykonawcy

1. Przeczytaj aktualne instrukcje repozytorium, bieżącą część `CONTEXT.md`, ten dokument i wybrany plan. Sprawdź `git status` i aktualny diff. Audyt nie jest dowodem dzisiejszego stanu; zastane zmiany z 8 września obejmowały CSS, manifest pakietu, lockfile i dokumentację.
2. Zachowaj Projekt jako trwały kontekst, Cel jako rezultat, Działanie bez obowiązkowego timera. Korzystaj z istniejącego kontraktu Workspace, komend, repozytoriów, koordynatora mutacji i nawigacji. Nie przywracaj mechaniki Commitment/Focus.
3. Doprowadź cały zakres wybranego planu do działającej implementacji. Jeśli fragment już istnieje, zweryfikuj go i uzupełnij rzeczywiste luki. Nie przebudowuj gotowych funkcji dla samej zgodności z historycznym opisem.
4. Mutacje wykonuj przez typowane, idempotentne komendy; UI nie zapisuje bezpośrednio do tabel. Odwracalne operacje zachowują undo; błędy zachowują tekst i stan użytkownika.
5. Dla backendu przygotuj lokalną addytywną migrację, zgodne adaptery demo/Supabase, testy SQL i izolacji Workspace. Nie wdrażaj migracji ani nie wykonuj `migration repair` bez osobnego zlecenia. Dla samej poprawki UI nie twórz migracji.
6. Kontrole wymagane przez projekt: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `VITE_DATA_BACKEND=demo pnpm build`, `pnpm check:bundle`. Najpierw testy celowane, potem końcowe kontrole. Przed uruchomieniem sprawdź bieżące skrypty. Dokumentuj istniejące, niezwiązane błędy; nie obniżaj progów, żeby uzyskać PASS.
7. Dla UI wykonaj przegląd w przeglądarce: desktop i 390×844, klawiatura, długi tekst, pusty widok, loading, błąd/retry. Dla planu 04 dodatkowo 320/430 px i zoom; dla offline produkcyjny build PWA. Brak prawdziwego telefonu lub stagingu oznacz jako brak weryfikacji, nie PASS.
8. Raport zapisuj pod `docs/testing/priority-2026-09-08/NN-report.md` (utwórz katalog przy pierwszym wykonaniu). Podaj datę, bazę kodu, zakres, pliki, wyniki poleceń, scenariusze, dowody, odstępstwa i brakujące kryteria. Osobno: „implementacja lokalna”, „staging”, „produkcja”.
9. W tym indeksie dopisz status i link do raportu. „Zakończony” wymaga spełnienia wszystkich kryteriów; „lokalnie gotowy, staging oczekuje” jest prawidłowym statusem pośrednim. Zachowaj istniejące zasady zamykania sprintów z nadrzędnego README; nie uznawaj braku dostępu za zgodę na pominięcie odbioru.

## Granice pakietu

Bez jasnego motywu, kalendarzy, operacji zbiorczych, importu danych, załączników, powiadomień, nowych funkcji AI i modułu powtórek nauki. Są w szerszym audycie, ale nie w tych zadaniach. Ta seria przygotowuje i weryfikuje zmiany; wdrożenie na produkcję jest osobnym zleceniem.
