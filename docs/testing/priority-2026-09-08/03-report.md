# Raport 03 — ochrona niezapisanej pracy

Data: 8 września 2026
Status: **lokalnie gotowy, staging oczekuje**

## Baza kodu

- Gałąź: `styling/UI/UX-improvments`
- HEAD przed realizacją: `666f41e`
- Working tree przed rozpoczęciem był czysty.
- Zakres: F04 z planu `03-persistent-drafts.md`; bez wdrożenia zdalnego i bez commita.

## Mapa formularzy i implementacja lokalna

Wspólny `usePersistentDraft` zapisuje kopertę lokalnie po `user/workspace/form/target`, z wersją schematu koperty, `savedAt` i `baseVersion`. Odczyt toleruje koperty v1, waliduje wartość, pomija uszkodzony JSON i nie zapisuje w trybie Supabase przed rozpoznaniem użytkownika oraz Workspace'u. `flush()` działa synchronicznie przy `pagehide`, `beforeunload`, ukryciu dokumentu i odmontowaniu formularza, więc wyjście przed 450 ms nie traci treści.

| Formularz | Stan |
| --- | --- |
| Quick Add: Działanie, Cel, Skrzynka | draft istniejący, przeniesiony na osobny klucz `new`, status lokalnego zapisu i jawne odrzucenie |
| Start: tworzenie Działania | objęty draftem `start-action:new` |
| Szczegół Celu: nowe Działanie | osobny draft per Cel |
| Szczegół Celu: szybki postęp | osobny draft per Cel |
| Szczegół Celu: blokada Działania | osobny draft per ID Działania |
| Szczegół Celu: edycja Celu i kryteriów | draft z wersją bazową Celu |
| Szczegół Celu: edycja Działania | draft per ID Działania |
| Szczegół Celu: powód porzucenia | draft per Cel |
| Szczegół Wiedzy: edycja | draft z wersją bazową Wiedzy |

Statusy mówią wyłącznie o urządzeniu: „Zapisywanie szkicu…”, „Szkic zapisany na tym urządzeniu” oraz błąd z „Ponów” i kopiowaniem treści. Nie ma komunikatu sugerującego zapis na serwerze. Zwykłe zamknięcie zachowuje draft; „Odrzuć szkic” usuwa tylko właściwy klucz. Wylogowanie czyści stare drafty lokalne zgodnie z istniejącą polityką prywatności, a zmiana konta nie może użyć timera starej tożsamości do zapisu pod nowym kluczem.

Cele i elementy Wiedzy mają teraz wersję w read modelu. Addytywna migracja dodaje `update_goal_details_checked` i `update_knowledge_item_checked`; zapis ze starą `expected_version` kończy się konfliktem. Store po konflikcie odświeża rekord, ale pozostawia lokalną treść w formularzu. UI oferuje skopiowanie własnego wariantu albo świadome otwarcie aktualnego rekordu; nie ma automatycznego scalania ani wymuszenia nadpisania.

Pliki objęte wynikiem zadania:

- `apps/web/src/hooks/usePersistentDraft.ts` i testy hooka
- `apps/web/src/components/DraftStatus.tsx`, `DraftCloseGuard.tsx`, `DraftConflictNotice.tsx`, `AlertDialog.tsx`
- `apps/web/src/pages/StartPage.tsx`, `GoalDetailPage.tsx`, `KnowledgeDetailPage.tsx`, `components/QuickAdd.tsx`
- `apps/web/src/app/store.tsx`, `store-context.ts`, `domain/commands.ts`, `domain/types.ts`
- `apps/web/src/auth/private-browser-state.ts`, `SupabaseAuthProvider.tsx`
- `apps/web/src/data/supabaseRepository.ts` oraz read model migracji
- `supabase/migrations/20260908090000_persistent_draft_version_checks.sql`
- `docs/planning/priority-implementation-2026-09-08/README.md`, ten raport

## Kontrole automatyczne

| Kontrola | Wynik | Dowód |
| --- | --- | --- |
| Testy draftów i migracji | PASS | `vitest run src/hooks/usePersistentDraft.test.tsx src/test/migrations.test.ts` — 2 pliki, 22 testy |
| Pełne testy | PASS | `pnpm test` — 50 plików, 279 testów |
| Lint | PASS | `pnpm lint` |
| Typy | PASS | `pnpm typecheck` |
| Build demo | PASS | `VITE_DATA_BACKEND=demo pnpm build` |
| Budżet bundla | PASS | `pnpm check:bundle` |
| Spójność diffu | PASS | `git diff --check` |

Testy obejmują szybki flush przed debounce, dwa ID tego samego typu formularza, kompatybilność starej koperty, uszkodzony JSON, błąd storage i retry, późną hydratację bez podmiany wpisanego tekstu, czyszczenie draftów przy wylogowaniu oraz konflikt wersji w PGlite. Koperta po szybkim wyjściu zawiera `baseVersion`; retry nie tworzy nowego zapisu serwerowego, bo komendy korzystają ze stabilnych kluczy idempotencji.

## Scenariusze odbioru lokalnego

- [x] Wpis → wyjście przed 450 ms → `flush()` zachowuje draft; ponowne otwarcie odczytuje go z właściwego klucza.
- [x] Dwa Cele i dwa typy formularzy mają oddzielne klucze; ID nie miesza treści.
- [x] A → wylogowanie → B: klucze A są odizolowane, a wylogowanie czyści lokalne drafty.
- [x] Późne dane rekordu nie podmieniają przywróconego ani już wpisywanego tekstu.
- [x] Uszkodzony JSON, błąd storage i błąd komendy nie usuwają bieżącej treści.
- [x] Sukces czyści właściwy draft, porażka go zostawia, a retry pozostaje jawne i idempotentne.
- [x] Zdalna zmiana wersji pozostawia lokalny i serwerowy wariant do świadomego rozstrzygnięcia.

## Weryfikacja w przeglądarce

Dev server próbowałem uruchomić poleceniem `VITE_DATA_BACKEND=demo pnpm dev -- --host 127.0.0.1`; sandbox zablokował nasłuch (`EPERM`). Po eskalacji Vite zgłosił gotowość na porcie 5174, ale `agent-browser` CLI nie jest zainstalowany, a CUA zwróciło, że ekran macOS jest zablokowany i nie może go automatycznie odblokować. Nie oznaczam więc jako PASS ręcznych scenariuszy desktop 1280×720, 390×844, klawiatury, reloadu w realnej przeglądarce ani wizualnego konfliktu. Ich odpowiedniki logiczne są pokryte testami hooka, store i migracji.

## Staging

Nie weryfikowano. Addytywna migracja i rzeczywisty konflikt dwóch sesji/urządzeń pozostają do wykonania w planie 09 na realnym koncie. Nie wykonano zdalnej migracji.

## Produkcja

Nie wdrażano i nie weryfikowano. Nie wykonano `migration repair`, publikacji ani commita.

## Odstępstwa i retencja

- Drafty nie są synchronizowane między urządzeniami; są przechowywane wyłącznie w `localStorage` bieżącej przeglądarki, rozdzielone przez User, Workspace, rodzaj formularza i target.
- Wylogowanie usuwa lokalne drafty oraz dotychczasowy prywatny cache. Błąd storage zachowuje treść w pamięci formularza i oferuje retry/kopiowanie.
- Ręczny przegląd UI oraz konflikt na stagingu czekają na odblokowane środowisko przeglądarkowe i realne konto.
