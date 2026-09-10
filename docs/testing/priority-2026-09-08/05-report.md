# Raport 05 — kompletna lista Działań

Data: 8 września 2026  
Status: **lokalnie gotowy, staging oczekuje**

## Baza kodu

- HEAD przed realizacją: `46cd1703953af9ecc11fbe6df63e62e5e5fac742`.
- Working tree przed realizacją był czysty.
- Zakres: plan 05 / F01, z wykorzystaniem rezultatów planu 04: resolvera kontekstu, mobilnych reguł czytelności, istniejącej nawigacji i trwałych szkiców.
- Nie wykonano commita, publikacji ani migracji zdalnej.

## Implementacja lokalna

- Dodano lazy route `/actions`; desktopową pozycję `Działania` oraz wejście w mobilnym menu `Więcej`, bez szóstego przycisku dolnego paska.
- Dodano sześć widoków: `open`, `today`, `overdue`, `unscheduled`, `blocked`, `completed`, z polskimi etykietami, filtrami `project` i `goal` oraz obsługą nieznanego `view` jako `open`.
- Reguła `Na dziś` jest współdzielona ze Startem: Działanie jest otwarte i ma `scheduledFor` równe lokalnej dacie Workspace albo nie ma terminu i ma `pinnedToToday=true`. Przypięcie samo w sobie nie czyni Działania zaległym.
- Lista dopuszcza samodzielne Działania, odrzuca brakujące/archiwalne/koszowane konteksty, uwzględnia Projekt dziedziczony przez Cel i pozostawia `paused` jako widoczny stan Celu.
- Demo ma deterministyczne filtrowanie, sortowanie i kursor; adapter Supabase korzysta z RPC z tym samym kontraktem. Strona ma limit 30, `Pokaż więcej`, loading/empty/error/retry i aktualizację po istniejącej komendzie ukończenia.
- Szczegół Działania ma odczyt `get_action_item`; nawigacja zachowuje URL filtrów, `sourceCardId`, scroll/fokus przez istniejący mechanizm nawigacyjny.
- Migracja: [20260908154542_actions_list_pagination.sql](../../../supabase/migrations/20260908154542_actions_list_pagination.sql) — indeksy kursorów, `get_actions_page`, `get_action_item`, `SECURITY INVOKER`, jawne granty tylko dla `authenticated`. Migrację przygotowano lokalnie; nie wdrażano jej zdalnie.

Najważniejsze pliki:

- [ActionsPage.tsx](../../../apps/web/src/pages/ActionsPage.tsx), [actionsList.ts](../../../apps/web/src/domain/actionsList.ts), [useWorkspaceInfinitePage.ts](../../../apps/web/src/hooks/useWorkspaceInfinitePage.ts).
- [workspaceRepository.ts](../../../apps/web/src/data/workspaceRepository.ts), [localWorkspaceRepository.ts](../../../apps/web/src/data/localWorkspaceRepository.ts), [supabaseWorkspaceRepository.ts](../../../apps/web/src/data/supabaseWorkspaceRepository.ts).
- [ActionDetailPage.tsx](../../../apps/web/src/pages/ActionDetailPage.tsx), [App.tsx](../../../apps/web/src/app/App.tsx), [AppShell.tsx](../../../apps/web/src/components/AppShell.tsx).
- Testy: `ActionsPage.test.tsx`, `actionsList.test.ts`, `localWorkspaceRepository.test.ts`, `supabaseWorkspaceRepository.test.ts`, `migrations.test.ts`, `App.regression.test.tsx`.

## Kontrole automatyczne

| Kontrola | Wynik |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 53 pliki, 292 testy |
| `VITE_DATA_BACKEND=demo pnpm build` | PASS |
| `pnpm check:bundle` | PASS |
| `git diff --check` | PASS |
| Migracje PGlite | PASS — 17 testów, w tym RLS, granica Workspace i paginacja |

## Scenariusze i dowody

- Samodzielne Działanie bez terminu: test integracyjny pokazuje je w `Otwarte`, a sprzeczne filtry nie są po cichu pomijane.
- Wszystkie widoki/filtry: testy domeny i regresji sprawdzają etykiety, nieznany `view`, filtr Projektu/Celu oraz AND.
- Ponad 60 rekordów: test lokalnego adaptera tworzy 65 Działań z powtarzającymi się datami i przechodzi przez trzy strony bez duplikatów/pominięć.
- Wynik spoza pierwszej strony: test repozytorium wykorzystuje kursor oraz stronę z filtrem; SQL testuje także filtr `today`.
- Archiwalny rodzic, obcy Workspace i `paused`: test PGlite potwierdza ukrycie archiwalnego Celu i izolację Workspace; test domeny potwierdza widoczność `paused`.
- Przeglądarka lokalna: na `http://127.0.0.1:5173/actions?view=overdue` potwierdzono widok, sześć zakładek, filtr `Finanse`, deep-link `Pobrać historię transakcji` oraz powrót do `/actions?view=overdue&project=area-finanse`. W szczególe widoczny był link breadcrumbu z zachowanymi parametrami.

Dokładnych viewportów `390×844`/`320`/`430`, zoomu 200% i klawiatury ekranowej nie udało się ustawić w dostępnej sesji przeglądarki; nie oznaczam ich jako PASS. Testy regresji pokrywają obecność mobilnego wejścia `Działania` w `Więcej`.

## Staging

Nie weryfikowano na realnym koncie ani stagingu. Migracja nie została wdrożona zdalnie. Do planu 09 pozostaje test rzeczywistego RPC, RLS, deep-linku po odświeżeniu oraz danych produkcyjnego Workspace.

## Produkcja

Nie wdrażano, nie wykonywano `migration repair`, nie publikowano aplikacji i nie tworzono commita.

## Odstępstwa i brakujące kryteria

- Brak narzędzia do wymuszenia dokładnych viewportów ogranicza wizualny odbiór mobilny; nie zmienia to wyników testów automatycznych ani kontraktu UI.
- Paginacja demo w hooku korzysta z aktualnego stanu Workspace, aby nie przegrać z wyścigiem hydracji trwałego magazynu; sam adapter demo i adapter Supabase pozostają przetestowane osobno.
- Odbiór staging/produkcja pozostaje otwarty zgodnie z zasadami README i należy do planu 09.
