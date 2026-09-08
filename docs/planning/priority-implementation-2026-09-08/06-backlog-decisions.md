# 06 — Porządkowanie zaległości bez opuszczania listy

Zakres: F02. Zależności: 05 i 02. Obowiązują [zasady wspólne](./README.md).

## Rezultat i punkty wejścia

Sugestia „Zdecyduj o zaległych Działaniach” prowadzi do właściwej kolejki. Ukończenie, przełożenie lub anulowanie odbywa się przy wierszu, z możliwością cofnięcia.

Przeczytaj nową listę z 05, `domain/homeSummary.ts`, `domain/weeklyReview.ts`, `components/ActionPrimaryControls.tsx`, `components/ActionResultDialog.tsx`, `components/ActionFeedback.tsx`, `hooks/useKeyedMutation.ts` i komendy aktualizacji/statusu Działania.

## Zakres

1. Ogólne sugestie zaległości kierują do `/actions?view=overdue`, blokad do `/actions?view=blocked`. Jeśli rekomendacja wskazuje jedno Działanie, prowadzi do właściwej kolejki z identyfikatorem zaznaczenia `highlight=<id>`; pozycja poza pierwszą stroną musi być odnajdywalna bez ręcznego przeklikiwania stron. Alternatywnie zachowaj deep link pojedynczego szczegółu z poprawnym powrotem do kolejki, jeśli jest to już spójny wzorzec — odnotuj wybór.
2. Menu wiersza: „Ukończ”, „Przełóż” (Dzisiaj/Jutro/Wybierz datę/Bez terminu), „Anuluj”. Zablokowany krok dodatkowo ujawnia powód i istniejącą drogę odblokowania; nie pomijaj walidacji domeny dla ukończenia.
3. Przełożenie modyfikuje tylko scheduledFor. Jeżeli krok pozostaje przypięty, powiedz „Nadal przypięte na dziś” i udostępnij oddzielne odpięcie. Nie zmieniaj ukrycie dwóch intencji jedną datą.
4. Ukończenie zachowuje istniejące reguły checklisty i opcjonalnego rezultatu. Rutyna: zmiana dotyczy wyłącznie jednego wystąpienia, nie szablonu i nie przyszłych rekordów.
5. Zapis ma blokadę powtórnego kliknięcia per rekord, loading, błąd i retry. Cofnięcie przywraca dokładny poprzedni status/datę i powiązane skutki zgodnie z domeną; nie resetuje cudzej, nowszej zmiany. Konflikt undo wymaga czytelnej informacji i odświeżenia.
6. Po zniknięciu wiersza z filtra fokus przechodzi na sąsiedni wiersz lub nagłówek pustej kolejki. Undo przywraca element w odpowiednim miejscu. Zachowaj filtry i przewinięcie, uzupełniaj widoczną stronę bez duplikatów.
7. Pusta kolejka po ostatniej decyzji: „Brak zaległych Działań” lub „Brak zablokowanych Działań”, z przejściem do otwartych. Bez automatycznego przenoszenia wszystkich dat i bez operacji zbiorczych.

## Odbiór

- [ ] Link z Podsumowania/Startu pokazuje faktyczną kolejkę, również po bezpośrednim otwarciu URL.
- [ ] Każdą z trzech decyzji wykonuje się bez przejścia do szczegółu; anulowanie nie usuwa rekordu.
- [ ] Zmiana daty zachowuje jawne przypięcie; seria Rutyny pozostaje niezmieniona.
- [ ] Błąd i retry nie podwajają zapisu; undo przywraca poprzedni stan i nie nadpisuje konfliktu.
- [ ] Lista po mutacji i powrót do niej zachowują filtry/fokus; ostatni element daje poprawny pusty widok.

Testy: flow 3 decyzji, przypięcie + przełożenie, pojedyncze wystąpienie, błąd i konflikt undo, koniec paginowanej kolejki. Kontrole i raport 06 według README.

## Polecenie do wklejenia

```text
Zaimplementuj plan /Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/06-backlog-decisions.md wraz z README, na działającej liście z planu 05. Zadbaj o linki, mutacje pojedynczych rekordów, undo, retry i fokus. Zapisz raport 06.
```
