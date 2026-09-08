# 07 — Bezpieczne odświeżanie między urządzeniami

Zakres: F06. Zależności: 03; obejmij także listę z 05/06. Obowiązują [zasady wspólne](./README.md).

## Rezultat i źródła

Po powrocie do karty użytkownik widzi bieżące dane serwera, a otwarty draft pozostaje nienaruszony. Może też ręcznie odświeżyć dane i rozpoznać awarię.

Przeczytaj `main.tsx` (`refetchOnWindowFocus: false`), `app/store.tsx`, `app/workspaceMutationCoordinator.ts` i testy, `components/AppShell.tsx`, `hooks/useWorkspaceInfinitePage.ts`, adaptery repozytorium oraz raport 03. Koordynator już potrafi nakładać oczekujące zmiany na świeży snapshot — wykorzystaj to zamiast drugiego niezależnego store.

## Zakres i domyślne decyzje

1. Najpierw odtwórz dwa klienty: A zapisuje, B wraca do aktywnej karty. Test lokalny z kontrolowanym repozytorium; przy dostępnym stagingu dwa odseparowane konteksty przeglądarki. Opisz obecne zachowanie.
2. Pierwsza wersja: odświeżanie przy powrocie do widocznej karty, jeżeli ostatni udany odczyt ma więcej niż 30 sekund, oraz ręczne „Odśwież dane”. Powrót sieci uruchamia pojedynczą próbę odczytu. Nie dodawaj Realtime ani stałego pollingu, jeśli te mechanizmy wystarczają.
3. Jeden współdzielony request dla równoczesnych triggerów; odpowiedź związana z użytkownikiem i Workspace. Stara odpowiedź po wylogowaniu/zmianie konta jest ignorowana. Nie odświeżaj niewidocznej karty w pętli.
4. Odśwież core oraz aktywne zależne zapytania/strony; nie zostawiaj listy lub szczegółu ze starym cache po nowym core. Nie resetuj filtrów i pozycji; jawnie obsłuż rekord usunięty z widoczności.
5. Zaktualizuj dane przez istniejącą koordynację pending/optimistic writes. Odpowiedź odczytu nie może cofnąć lokalnego pending ani dopiero zakończonej mutacji. Zdefiniuj porządek lub mechanizm ponownego odczytu dla wyścigu read/write.
6. Stan odczytu rozdziel od stanu zapisu: „Odświeżanie…”, „Dane odświeżone [czas]”, „Nie udało się odświeżyć — pokazujemy poprzednie dane”. Timestamp aktualizuj dopiero po udanym odczycie; pusty pendingCount nie dowodzi aktualności serwera.
7. Formularz z 03 zachowuje draft i wersję bazową. Konflikt nie prowadzi do silent overwrite. Utrata dostępu nie uruchamia retry bez końca; pokaż odpowiednie wyjście/logowanie.

## Odbiór

- [ ] A zapisuje; B po powrocie i przekroczeniu progu widzi zmianę bez wylogowania.
- [ ] Ręczny refresh działa również przed progiem 30 s; wiele triggerów nie mnoży zapytań.
- [ ] Refetch w czasie zapisu nie usuwa optymistycznej zmiany ani draftu.
- [ ] Opóźniona odpowiedź dla starego konta/wersji nie przywraca starych danych.
- [ ] Błąd zachowuje poprzedni widok i daje retry, z uczciwą datą aktualności.
- [ ] Core, otwarta strona i szczegół są zgodne po odświeżeniu; nawigacja zachowuje kontekst.

Testy wyścigów i czasu na koordynatorze/store; UI scenariusz dirty form → refresh. Staging E2E jest wymagane do pełnego odbioru, a brak dostępu wpisuje się do raportu 07 i planu 09. Kontrole według README.

## Polecenie do wklejenia

```text
Zaimplementuj plan /Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/07-data-freshness.md wraz z README. Najpierw odtwórz problem, potem wprowadź odświeżanie z ochroną pending writes i draftów. Zweryfikuj wyścigi oraz dwa konteksty przeglądarki; zapisz raport 07 i jawnie wskaż brakujące E2E.
```
