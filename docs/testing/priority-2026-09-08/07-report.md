# Raport 07 — aktualność danych między urządzeniami

Data: 8 września 2026  
Status: **lokalnie gotowy, staging oczekuje**

## Baza kodu i zakres

- Gałąź: `styling/UI/UX-improvments`, HEAD przed zmianą: `9f7b9f4`.
- Zakres: plan 07, z ochroną draftów z planu 03 oraz odświeżaniem listy Działań i szczegółów z planów 05–06.
- Nie zmieniano schematu, nie wdrażano migracji, nie publikowano produkcji i nie tworzono commita.

## Odtworzenie problemu przed poprawką

Dodany test koordynatora odtwarzał wyścig: odczyt rozpoczął się przed zapisem, zapis zakończył się poprawnie, a opóźniona odpowiedź starego snapshotu przywracała `old-a` zamiast `new-a`. Test przed poprawką kończył się: `expected 'old-a' to be 'new-a'`.

## Implementacja lokalna

- `WorkspaceMutationCoordinator` prowadzi rewizję zapisów, czeka na bezczynność operacji i odrzuca snapshot odczytany przed rozpoczęciem zapisu. Reset generacji po zmianie Usera ignoruje późne zakończenia starej sesji.
- `WorkspaceDataFreshness` rozdziela aktualność od `pendingCount`: próg wynosi ponad 30 s, ręczny odczyt omija próg, równoczesne triggery współdzielą jedno żądanie, a błąd zachowuje poprzedni timestamp.
- `StoreProvider` odświeża po powrocie widoczności i po `online`, sprawdza tożsamość Usera, nakłada pending/optimistic writes, wykonuje ponowny odczyt po wyścigu read/write oraz unieważnia aktywne strony, listę Działań i zapytania szczegółów.
- `AppShell` pokazuje „Odświeżanie…”, „Dane odświeżone [czas]” oraz „Nie udało się odświeżyć — pokazujemy poprzednie dane”; ręczne „Odśwież dane” jest dostępne w menu profilu i w menu mobilnym.
- Odświeżenie nie resetuje filtrów, kursora ani pozycji nawigacji. Formularze z planu 03 pozostają lokalnymi draftami; test dirty form potwierdza zachowanie wpisanej treści po refreshu.

Najważniejsze pliki:

- `apps/web/src/app/workspaceDataFreshness.ts` i testy,
- `apps/web/src/app/workspaceMutationCoordinator.ts` i testy,
- `apps/web/src/app/store.tsx`, `store-context.ts` i testy integracyjne,
- `apps/web/src/components/AppShell.tsx`.

## Kontrole automatyczne

| Kontrola | Wynik | Dowód |
| --- | --- | --- |
| `pnpm lint` | PASS | ESLint bez ostrzeżeń i błędów |
| `pnpm typecheck` | PASS | TypeScript bez błędów |
| `pnpm test` | PASS | 54 pliki, 307 testów |
| `VITE_DATA_BACKEND=demo pnpm build` | PASS | build Vite/PWA wygenerowany |
| `pnpm check:bundle` | PASS | CSS 35 839 B gzip, poniżej limitu 35 840 B |
| `git diff --check` | PASS | brak błędów whitespace |

Testy planu obejmują próg czasu, deduplikację, błąd/retry, zmianę tożsamości, opóźniony read po write, ręczny refresh, ponowny odczyt po wyścigu oraz dirty form.

## Weryfikacja dwóch kontekstów przeglądarki

W lokalnym serwerze `VITE_DATA_BACKEND=demo pnpm dev -- --host 127.0.0.1` (Vite wybrał port 5174) otwarto dwie niezależne karty in-app browser. Klient A ukończył dwa Działania. Klient B, uruchomiony osobno, po powrocie/reloadzie pokazał `0 Działań na dziś` i `2 ukończone Działania w tygodniu`. To potwierdza lokalną trwałość IndexedDB i odczyt aktualnego stanu w drugim kontekście.

Nie oznaczam jako PASS automatycznego przejścia dokładnie po 30 s w dwóch widocznych kartach: dostępne środowisko nie daje kontrolowanego stagingowego konta ani narzędzia do wiarygodnego przełączania widoczności karty. Próg i trigger są pokryte testami kontrolera/store.

## Staging

Nie wykonano E2E na realnym koncie ani dwóch sesji Supabase. Brakuje potwierdzenia: A zapisuje na stagingu, B wraca po przekroczeniu 30 s i widzi zmianę bez wylogowania; zachowania przy realnym błędzie sieci; spójności RPC, RLS, aktywnej strony listy i szczegółu; konfliktu draftu między dwoma kontami. Migracje planów 03–06 są opisane jako wdrożone w raporcie 06, ale nie wykonywano w tym zadaniu żadnej zdalnej operacji.

## Produkcja

Nie wdrażano i nie weryfikowano produkcji.

## Brakujące testy E2E / kryteria otwarte

- [ ] staging: dwa odseparowane konteksty przeglądarki, A zapisuje, B wraca po ponad 30 s i widzi zmianę;
- [ ] staging: ręczny refresh przed progiem i wiele triggerów bez zwielokrotnienia requestów;
- [ ] staging: dirty form oraz pending write podczas opóźnionego odczytu;
- [ ] staging: spóźniona odpowiedź starego Usera/Workspace'u oraz utrata dostępu bez nieskończonego retry;
- [ ] staging: aktywna strona `/actions`, szczegół Działania/Celu/Wiedzy, zachowane filtry i przypadek rekordu usuniętego z widoczności;
- [ ] realny telefon lub wiarygodny test viewportu po powrocie do widocznej karty.

Te braki należą do odbioru planu 09 i nie obniżają statusu implementacji lokalnej.
