# 03 — Ochrona niezapisanej pracy

Zakres: F04. Zależności: brak; fundament planów 04 i 07. Obowiązują [zasady wspólne](./README.md).

## Rezultat i stan

Tekst można odzyskać po przypadkowym wyjściu lub reloadzie. Draft nie jest zapisem na serwerze i nie nadpisuje nowszej wersji rekordu.

Punkty wejścia: `hooks/usePersistentDraft.ts`, `components/DraftStatus.tsx`, `components/DraftCloseGuard.tsx`, `components/QuickAdd.tsx`, `pages/StartPage.tsx`, `pages/GoalDetailPage.tsx`, `pages/KnowledgeDetailPage.tsx`, `auth/private-browser-state.ts`, `auth/SupabaseAuthProvider.tsx`, `app/workspaceMutationCoordinator.ts`.

Hook już izoluje klucz według użytkownika i Workspace. Obecna koperta ma wersję/savedAt/value, opóźnienie 450 ms i początkową wartość zapamiętaną w ref. Przed rozbudową sprawdź zmianę klucza, późną hydratację i wyjście przed upływem debounce.

## Zakres

1. Sporządź w raporcie krótką mapę formularzy z edycją tekstu: co już ma draft, co wymaga ochrony. W tym zadaniu obowiązkowo obejmij wszystkie formularze tekstowe Startu, szczegółu Celu i szczegółu Wiedzy: tworzenie/edycję, postęp, powód blokady/porzucenia. Istniejące drafty Quick Add, tworzenia Celu/Wiedzy, Rutyn i Podsumowania sprawdź pod kątem regresji wspólnego hooka.
2. Klucz draftu obejmuje użytkownika, przestrzeń, rodzaj formularza i ID docelowego rekordu. Tworzenie nowego obiektu ma własny klucz, niezależny od edycji istniejącego. Nie zapisuj prywatnych treści pod tymczasową tożsamością `anonymous/local` w zdalnym trybie przed rozpoznaniem konta.
3. Draft zapamiętuje wersję bazową edytowanego rekordu. Obsłuż kompatybilny odczyt starych kopert. Dane przywracane z pamięci wymagają walidacji; uszkodzony wpis nie może wywrócić formularza.
4. Komunikaty: „Zapisywanie szkicu…”, „Szkic zapisany na tym urządzeniu”, błąd zapisu z możliwością ponowienia/kopiowania. Przy odzyskaniu: „Przywrócono szkic” i „Odrzuć szkic”. Nigdy „Zapisano” sugerujące sukces serwera.
5. Zwykłe zamknięcie zachowuje draft; jawne odrzucenie go czyści. Po udanym zapisie komendy wyczyść tylko właściwy draft. Po błędzie lub niepewnym wyniku zachowaj treść i stabilną intencję retry, aby nie tworzyć duplikatów postępu.
6. Zabezpiecz przejście między trasami i zamknięcie przed debounce; wykorzystaj flush lub równoważny mechanizm. Nie opieraj trwałości wyłącznie na asynchronicznej operacji przy unload. Zmiana konta anuluje stare timery i żądania; żaden stary formularz nie zapisuje do klucza nowego konta.
7. Gdy serwer ma nową wersję, zachowaj lokalną treść i pokaż konflikt. Pierwsza wersja oferuje porównanie/kopiowanie własnej treści oraz ponowne otwarcie aktualnego rekordu; bez automatycznego scalania lub wymuszenia nadpisania. Sam refetch nie może resetować edytowanego formularza.
8. Nie synchronizuj draftów między urządzeniami. Zachowaj istniejącą politykę wylogowania/prywatności; w raporcie wyjaśnij retencję draftów i odizolowanie kont.

## Odbiór

- [ ] Wpis → szybka nawigacja/reload przed 450 ms → odzyskanie tekstu.
- [ ] Dwa Cele i dwa typy formularzy mają oddzielne drafty; ID nie miesza treści.
- [ ] A → wylogowanie → B nie pokazuje ani nie wysyła tekstu A.
- [ ] Późne załadowanie rekordu nie podmienia przywróconego lub już wpisywanego tekstu.
- [ ] Błąd storage, uszkodzony JSON i błąd komendy są obsłużone bez utraty bieżącego tekstu.
- [ ] Sukces usuwa właściwy draft; porażka go zostawia; retry nie dubluje wpisu.
- [ ] Zdalna zmiana wersji pozostawia oba warianty do świadomego rozstrzygnięcia.

Testy: hook z timerami i zmianą tożsamości, integracja edytora Wiedzy/postępu Celu, regresja istniejących draftów. Scenariusz rzeczywistego konfliktu na staging w planie 09. Kontrole i raport 03 według README.

## Polecenie do wklejenia

```text
Zaimplementuj plan /Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/03-persistent-drafts.md wraz z zasadami README. Rozszerz istniejącą ochronę treści, przetestuj szybkie wyjście, zmianę konta i konflikt wersji, zapisz raport 03. Nie utożsamiaj lokalnego szkicu z zapisem serwera.
```
