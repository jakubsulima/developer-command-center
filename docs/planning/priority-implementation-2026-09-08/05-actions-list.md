# 05 — Kompletna lista Działań

Zakres: F01. Zależności: 04 jako baza UI. Obowiązują [zasady wspólne](./README.md).

## Rezultat i źródła

Użytkownik odnajduje każde Działanie, także samodzielne bez daty, przez nowy widok `/actions`. Nie musi znać tytułu ani otwierać wszystkich Celów.

Punkty wejścia: `app/App.tsx`, `components/AppShell.tsx`, `domain/navigation.ts`, `domain/routes.ts`, `domain/actionContext.ts`, `domain/homeSummary.ts`, `hooks/useWorkspaceInfinitePage.ts`, `data/workspaceRepository.ts`, oba adaptery repozytorium i store. Kontrakt paginacji obecnie ma m.in. `completed-actions`, ale nie ma filtrowanej, zbiorczej kolekcji wszystkich Działań.

## Kontrakt użytkownika

- Trasa `/actions?view=open`; brak lub błędne `view` daje `open`.
- Widoki: `open`, `today`, `overdue`, `unscheduled`, `blocked`, `completed`. Polskie etykiety: Otwarte, Na dziś, Zaległe, Bez terminu, Zablokowane, Ukończone.
- Dodatkowe filtry `project=<id>` i `goal=<id>` łączą się przez AND. Projekt uwzględnia kontekst dziedziczony przez Cel według bieżących reguł domeny. Sprzeczne filtry pokazują pusty wynik i możliwość wyczyszczenia, bez cichego pomijania jednego z nich.
- Otwarte: ready/in_progress/blocked. Bez terminu: otwarte bez scheduledFor, także przypięte. Zaległe: otwarte z datą wcześniejszą od dnia w strefie przestrzeni. Zablokowane: status blocked. Ukończone: completed; anulowanych/pominiętych nie nazywaj ukończonymi.
- Na dziś: ta sama reguła co istniejąca projekcja Startu. Sprawdź aktualny kod; współdziel regułę zamiast tworzyć inną interpretację przypięcia i zaległości. Zapisz dokładną regułę w raporcie.
- Domyślnie tylko Działania należące do aktywnie widocznych kontekstów; stan `paused` Celu to nie archiwizacja. Nie wskrzeszaj obiektów z archiwum/kosza w wyniku listowania. Historię anulowanych/pominiętych i archiwum pozostaw w istniejących widokach kontekstowych.

## Zakres implementacji

1. Lazy route, desktopowa pozycja „Działania”; mobile link w menu „Więcej”, bez szóstego przycisku dolnego paska. Bez zmiany domyślnej strony Start.
2. Widok ma tytuł, jedno dodawanie Działania, filtry, listę i stany loading/empty/error/retry. Quick Add może przyjąć jednoznaczny kontekst aktywnego filtra; nie ustawia ukrytej daty na podstawie widoku „Zaległe”.
3. Paginacja po stronie repozytorium/serwera, także dla filtrów. Nie filtruj wyłącznie załadowanej strony i nie pobieraj eksportu jako źródła listy. Limit strony 30, stabilny kursor i dogrywanie „Pokaż więcej”.
4. Otwarte widoki sortuj po dacie rosnąco, bez dat na końcu, następnie stabilnie po ID; Ukończone po completedAt malejąco i ID. Zdefiniuj jawnie null i kierunek kursora w obu adapterach. Jeśli istniejący kontrakt wymaga rozszerzenia, dodaj zgodny wariant query, nie psuj starszych kolekcji.
5. Każdy wiersz: tytuł, kontekst, data/status, kontrolka ukończenia i link szczegółu. Pozostałe decyzje na liście dostarczy 06. Mutacja aktualizuje wynik oraz cache; przy zmianie filtra resetuj kursor. Opóźniona odpowiedź starego filtra nie zastępuje bieżącej listy.
6. Powrót ze szczegółu odtwarza URL filtrów, dograne strony, pozycję i fokus/oznaczenie źródłowego wiersza. Nie wymaga trzymania całego Workspace w pamięci.
7. Jeśli potrzebne RPC: lokalna addytywna migracja, jawne uprawnienia i RLS, ten sam wynik w demo/Supabase. Podłącz całą ścieżkę, nie zostawiaj zdalnej implementacji jako TODO.

## Odbiór

- [ ] Samodzielny krok bez terminu jest widoczny i otwieralny; odpięcie ze Startu go nie gubi.
- [ ] Wszystkie widoki i filtry działają po reloadzie/deep linku, również ze sprzecznymi lub nieaktualnymi ID.
- [ ] Zbiór ponad 60 rekordów z powtarzającymi się datami przechodzi przez 3 strony bez duplikatów i pominięć.
- [ ] Wynik spoza pierwszej strony jest odnajdywany filtrem serwera.
- [ ] Archiwalny rodzic i obcy Workspace nie ujawniają rekordów; paused nie oznacza archiwum.
- [ ] Ukończenie działa istniejącą komendą, a powrót ze szczegółu zachowuje miejsce.

Testy: reguły filtrów/daty, kontrakt adapterów, paginacja/izolacja SQL, integracja nawigacji. Kontrole i raport 05 według README; aktualna historia stagingu sprawdzona przed przygotowaniem wydania backendu zgodnie z 09.

## Polecenie do wklejenia

```text
Zaimplementuj plan /Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/05-actions-list.md wraz z README. Dostarcz kompletny przepływ listy, filtrów, paginacji i powrotu dla demo oraz adaptera Supabase, z lokalnymi migracjami/testami. Nie wdrażaj migracji zdalnie. Zapisz raport 05.
```
