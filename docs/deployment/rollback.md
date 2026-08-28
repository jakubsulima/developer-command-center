# Runbook rollbacku

Rollback wykonujemy najpierw na stagingu. Produkcja wymaga potwierdzenia
użytkownika po sprawdzeniu planu, eksportu/backupów i wpływu na dane.

## Frontend (Vercel)

1. Otwórz projekt Vercel i wybierz ostatni zdrowy deployment z gałęzi `main`.
2. Sprawdź, że deployment wskazuje właściwy projekt Supabase i nie zawiera
   sekretów w zmiennych `VITE_*`.
3. Użyj `Promote to Production` dla ostatniego zdrowego deploymentu.
4. Wykonaj smoke test: logowanie, Start, przejście do Skrzynki, zapis i reload.
5. Zapisz URL deploymentu, commit oraz czas rollbacku w raporcie wydania.

Rollback frontendu nie cofa danych. Jeśli nowy frontend zapisał dane w nowym
formacie, najpierw upewnij się, że starsza wersja potrafi je czytać.

## Migracje Supabase

Migracje są stosowane do przodu. Nie usuwaj historii migracji i nie używaj
`git reset --hard` jako metody rollbacku.

1. Zatrzymaj dalsze wdrożenia i wyłącz problematyczną funkcję kill switchem,
   jeśli jest dostępny.
2. Na stagingu odtwórz scenariusz na kopii/bezpiecznych danych i sprawdź
   `pnpm supabase:plan` dla migracji naprawczej.
3. Przygotuj nową, kompensującą migrację przez `supabase migration new
   rollback_<opis>`; zachowaj RLS, granty i klucze workspace.
4. Zastosuj ją na stagingu, uruchom `pnpm supabase:lint:remote` i wykonaj E2E.
5. Po zatwierdzeniu zastosuj tę samą migrację na produkcji workflowem
   `Wdrożenie migracji Supabase` z environment `production`.

Jeśli potrzebne jest odtworzenie danych, użyj backupu/PITR Supabase zgodnie z
planem projektu i najpierw zabezpiecz aktualny eksport. Odtworzenie bazy jest
operacją destrukcyjną i wymaga osobnej decyzji właściciela.

## Edge Function

1. Wyłącz funkcję przez jej kill switch, np. `AI_GOAL_REVIEW_ENABLED=false` lub
   `AI_INBOX_TRIAGE_ENABLED=false`.
2. Ustal ostatni zdrowy commit funkcji i porównaj sekrety/konfigurację stagingu.
3. Wdroż poprzednią wersję z tego commitu: `supabase functions deploy
   <function-name> --project-ref <staging-ref>`.
4. Sprawdź odpowiedź 401 bez JWT, poprawną odpowiedź z JWT oraz logi pod kątem
   braku treści Celów, Działań, Wiedzy i sekretów.
5. Powtórz na produkcji dopiero po potwierdzeniu i odnotuj wersję funkcji.

Po rollbacku obserwuj monitoring przez co najmniej jeden cykl użycia. Adapter
diagnostyczny można wyłączyć przez `VITE_ERROR_REPORTING_ENABLED=false` i nowy
build frontendu; sam monitoring nie może blokować działania aplikacji.
