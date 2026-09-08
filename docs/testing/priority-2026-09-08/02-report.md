# Raport 02 — podsumowanie bieżącej pracy i spójny język

Data: 8 września 2026  
Status: **lokalnie gotowy, staging oczekuje**

## Baza kodu

- Gałąź: `styling/UI/UX-improvments`
- HEAD przed realizacją: `a5f285e`
- Przed rozpoczęciem zadania working tree był czysty.
- Zakres obejmował F05 i U06 z planu `02-summary-and-language.md`.

## Implementacja lokalna

Aktywne Podsumowanie pokazuje trzy źródłowe metryki: ukończone Działania, dodaną Wiedzę i aktualizacje postępu. Kafelek minut Focus oraz sugestia oparta na dawnych Commitmentach zostały usunięte z aktywnego UI. Historyczny `focusMinutes`, stare rekordy i eksport pozostają czytelne dla kompatybilności; nowe podsumowanie nie dopisuje pomiaru czasu bez źródła.

Wspólne filtry aktywności wykluczają archiwalne/usunięte konteksty rodzica. Bieżący tydzień używa poniedziałku w strefie Workspace do następnego poniedziałku, z końcem przedziału wyłącznym. Lokalny adapter wylicza te same okresy, a Supabase otrzymał addytywny RPC `get_workspace_weekly_summary`, bez zmiany istniejącego kontraktu i bez wdrażania migracji zdalnie. Odczyt toleruje starszy backend bez nowego RPC.

Usunięto arbitralny limit projektów z sugestii i zachowano tylko faktyczne blokady, zaległości, brak następnego kroku oraz Skrzynkę. Dodano polskie odmiany liczb dla 0/1/2/5/12/22/112 i poprawiono tekst „Dalszego planu”, tak aby liczba spraw wymagających uwagi nie była ucinana. Typ Celu `project` jest prezentowany jako „Projektowy”, a trwały kontekst nadal jako „Projekt”. Widoczne komunikaty `Workspace` zostały zastąpione przez „przestrzeń pracy”; identyfikatory techniczne pozostały bez zmian.

Pliki objęte wynikiem zadania:

- `apps/web/src/domain/activity.ts`, `weeklyReview.ts`, `homeSummary.ts`, `labels.ts`, `types.ts` oraz testy domenowe
- `apps/web/src/data/localWorkspaceRepository.ts`, `supabaseWorkspaceRepository.ts`, `supabaseRepository.ts`, `workspaceRepository.ts`
- `apps/web/src/pages/ReviewPage.tsx`, `StartPage.tsx` oraz komponenty i komunikaty językowe
- `apps/web/src/styles.css`, `apps/web/src/test/migrations.test.ts`, testy regresji aplikacji
- `supabase/migrations/20260908090000_workspace_weekly_summary_timezone.sql`
- `docs/planning/priority-implementation-2026-09-08/README.md`

## Kontrole automatyczne

| Kontrola | Wynik | Dowód |
| --- | --- | --- |
| Testy celowane | PASS | `pnpm --filter @command/web exec vitest run src/domain/activity.test.ts src/domain/weeklyReview.test.ts src/domain/homeSummary.test.ts src/data/localWorkspaceRepository.test.ts src/test/migrations.test.ts` — 5 plików, 51 testów |
| Testy pełne | PASS | `pnpm test` — 50 plików, 275 testów |
| Lint | PASS | `pnpm lint` |
| Typy | PASS | `pnpm typecheck` |
| Build demo | PASS | `VITE_DATA_BACKEND=demo pnpm build` |
| Budżet bundla | PASS | `pnpm check:bundle` |
| Spójność diffu | PASS | `git diff --check` |

Testy obejmują pustą przestrzeń, wykluczenie archiwalnego rodzica, granicę końca tygodnia, strefę czasu, odmiany liczb, zgodność migracji PGlite oraz zachowanie starszego podsumowania. Test regresji formularza został ustabilizowany przez oczekiwanie na leniwie ładowany dialog; nie zmieniono zachowania produkcyjnego.

## Scenariusze odbioru lokalnego

- [x] Aktywne Podsumowanie nie pokazuje minut Focus ani dawnego limitu Commitment.
- [x] Historyczne rekordy Focus, stare pola kontraktu i eksport nie są przepisywane.
- [x] Liczniki nie obejmują archiwalnych rodziców i nie zależą od pierwszej strony historii.
- [x] Okres tygodnia jest liczony jako poniedziałek–poniedziałek w strefie przestrzeni pracy, z końcem wyłącznym.
- [x] „Projekt” jako kontekst i „Projektowy” jako typ Celu są rozróżnione.
- [x] Liczby 0/1/2/5/12/22/112 mają poprawną odmianę, a uwaga w „Dalszym planie” jest widoczna.
- [x] Adapter lokalny zachowuje zapis/odczyt podsumowania; adapter Supabase zachowuje kompatybilność ze starszym backendem i nowym addytywnym RPC.

## Weryfikacja w przeglądarce

Lokalny serwer demo uruchomiono poleceniem `VITE_DATA_BACKEND=demo pnpm dev --host 127.0.0.1`, ale przegląd desktopowy i 390×844 **nie został zweryfikowany**. CLI `agent-browser` nie było dostępne, a automatyzacja CUA zatrzymała się na zablokowanym ekranie macOS. Nie oznaczam więc jako PASS scenariuszy wizualnych, klawiatury, długiego tekstu, pustego widoku, loadingu ani błędu/retry.

## Staging

Nie weryfikowano. Nie ma dostępu do stagingu ani prawdziwego konta; nie wykonano zdalnej migracji.

## Produkcja

Nie wdrażano i nie weryfikowano. Nie wykonano `migration repair`, publikacji ani commita.

## Odstępstwa i brakujące kryteria

- Ręczny przegląd UI na desktopie i 390×844 pozostaje do wykonania po odblokowaniu środowiska z przeglądarką.
- Odbiór na stagingu i produkcji pozostaje zakresem planu 09.
- Addytywna migracja jest przygotowana i przetestowana lokalnie, ale celowo nie została wdrożona zdalnie.
