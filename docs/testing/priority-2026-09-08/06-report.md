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
- Dodano addytywną migrację wersjonowanego `set_action_status_checked`.

### Testy i kontrole

- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm test` — standardowe uruchomienie równoległe nie przechodziło, bo środowisko Node 20.10.0 powodowało timeouty na ekranie ładowania. Pełny Vitest uruchomiony na bundlowanym Node 24 z `--maxWorkers=1`: **53 pliki, 299 testów — PASS**.
- Testy celowane planu 06 na Node 24: **7 plików, 71 testów — PASS**; końcowa regresja Actions/feedback: **2 pliki, 11 testów — PASS**.
- `VITE_DATA_BACKEND=demo pnpm build` — PASS.
- `pnpm check:bundle` — PASS; CSS 35 839 B gzip przy limicie 35 840 B.
- `git diff --check` — PASS.
- Przegląd lokalnego UI w przeglądarce — desktop PASS: bezpośrednie `/actions?view=overdue` otwiera kolejkę, widoczne są trzy Działania i menu pojedynczego wiersza z decyzjami. Tryb demo uruchomiono przez `VITE_DATA_BACKEND=demo`.

### Aktualizacja wdrożenia migracji — 8 września 2026

- Cel: podpięty projekt Supabase `khlhhwfsxfxffawlghxh`; nie publikowano frontendu ani produkcji.
- Naprawiono wyłącznie historię migracji: cztery zdalne wpisy bez plików w repozytorium oznaczono jako `reverted`; cztery migracje, których obiekty były już potwierdzone w schemacie, oznaczono jako `applied`.
- Dry-run przed wdrożeniem wskazał dokładnie 7 migracji: `20260827164703`, `20260830120000`, `20260830121000`, `20260908090000`, `20260908090100`, `20260908154542`, `20260908170000`.
- `supabase db push --linked` — PASS; wszystkie 7 migracji zastosowane.
- `supabase migration list --linked` — PASS; każda lokalna wersja ma odpowiadający wpis zdalny.
- Weryfikacja read-only — PASS: obecne są RPC triage, paginacji, podsumowania tygodniowego i wersjonowanych zapisów; grant `authenticated` jest aktywny, `anon` nie ma wykonania; obecne są tabele triage i indeks jednego wyniku na Działanie.
- Końcowy `supabase db push --linked --dry-run` — PASS; baza zgłasza `Remote database is up to date`.
- `pnpm supabase:lint:remote` — PASS bez błędów blokujących. Zgłoszono 4 ostrzeżenia w istniejących funkcjach (`update_goal_details`, `update_knowledge_item`, `create_knowledge_with_relations`, `add_progress_checked`); nie zmieniano ich w ramach tego wdrożenia.
- CLI zgłosiło ostrzeżenie o nieudanym lokalnym cache pg-delta z powodu blokady montowania ścieżki przez Docker; nie wpłynęło to na zastosowanie migracji ani weryfikację zdalną.

## Staging

Migracje zostały wdrożone do podpiętego projektu i zweryfikowane na poziomie schematu/RPC. Nie wykonano jeszcze odbioru przepływu na realnym koncie ani testu izolacji Workspace; te scenariusze pozostają zakresem planu 09.

## Produkcja

Nie wdrażano produkcji.

## Odstępstwa i brakujące dowody

Nie wykonano osobnego przeglądu w rozmiarze 390×844, z pełnym przepływem klawiatury, długimi tekstami oraz stanami loading/error. Testy RTL i build nie zastępują tego odbioru. Implementacja i migracje są gotowe, ale pełny odbiór stagingowy nadal oczekuje.
