# 02 — Podsumowanie bieżącej pracy i spójny język

Zakres: F05, U06. Zależności: brak. Obowiązują [zasady wspólne](./README.md).

## Rezultat i źródła

Podsumowanie opisuje Działania, Wiedzę i postęp, a nie historyczne sesje Focus. Przeczytaj `pages/ReviewPage.tsx`, `domain/weeklyReview.ts`, `domain/activity.ts`, `domain/labels.ts`, `domain/types.ts`, `data/workspaceRepository.ts`, adaptery repozytorium oraz aktualny model w `CONTEXT.md`.

Obecnie UI pokazuje `focusMinutes`, sugestia limitu pracy czyta `state.projects[].commitmentStatus`, a kontrakt `weeklySummary` nadal zawiera historyczną metrykę. Nie usuwaj historycznych danych ani nie zmieniaj znaczenia zapisanych raportów.

## Decyzje i zakres

1. Bieżący ekran pokazuje trzy wiarygodne metryki: ukończone Działania, dodana Wiedza, aktualizacje postępu. Usuń kafel minut Focus z aktywnego podsumowania. Zachowaj zgodność eksportu i odczytu historii.
2. Nie zastępuj minut licznikiem „Celów osiągniętych w tygodniu” opartym na `updatedAt` lub samym bieżącym statusie. Ten licznik jest poza pierwszą wersją; wymaga osobno wiarygodnej daty/zdarzenia osiągnięcia i agregacji serwera.
3. Usuń sugestię opartą na starych Commitments. W pierwszej wersji nie wprowadzaj arbitralnego limitu trzech Projektów/Celów. Zostaw sugestie faktycznych blokad, zaległości, braku następnego kroku i Skrzynki, zgodne z widocznością bieżących obiektów.
4. Sprawdź zgodność liczb między lokalnym wyliczeniem a `weeklySummary` z serwera. Bieżący tydzień to przedział od poniedziałku w strefie Workspace do następnego poniedziałku, koniec wyłączny. Nie licz pełnej historii z pierwszej strony paginacji.
5. Nowo zapisane podsumowanie nie przedstawia historycznego Focus jako bieżącej pracy. Jeżeli pole musi pozostać w kontrakcie kompatybilności, nie oznaczaj braku pomiaru jako nowego pomiaru czasu. Odczyt starszych podsumowań zachowuje oryginał.
6. W aktywnym UI zamień „Workspace” na „przestrzeń pracy”; zachowaj techniczne identyfikatory. W etykiecie typu Celu `project` użyj „Projektowy”, a „Projekt” pozostaw dla trwałego kontekstu. Nie zmieniaj enumów/migracji tylko dla tłumaczenia.
7. Ujednolić odmiany liczb w Start/Podsumowanie/listach: 0, 1, 2, 5, 12, 22, 112. W ciasnych licznikach można stosować „Działania: 1” zamiast skomplikowanego zdania. Zachować tekst dostępny dla czytnika.
8. „Dalszy plan” ma krótko pokazywać zwłaszcza liczbę spraw wymagających uwagi. Nie ukrywać jej przez ucinanie końca długiego zdania. Daty kalendarzowe nie przesuwają się wskutek konwersji strefy.

## Odbiór

- [ ] Aktywne podsumowanie nie prezentuje „min fokusu” ani starego limitu Commitments.
- [ ] Stare rekordy i eksport pozostają czytelne, bez przepisania historycznych wartości.
- [ ] Liczby są poprawne dla pustej przestrzeni, archiwalnych rodziców, historii większej niż strona i granicy tygodnia/strefy.
- [ ] UI odróżnia Projekt od typu Celu; teksty i polskie liczebniki są spójne.
- [ ] Zapis i ponowne otwarcie podsumowania działają w obu adapterach.

Testy: `weeklyReview`, `activity`, regresja Podsumowania i ewentualnego mapowania repozytorium. Nie dodawaj testów kopiujących każdą zmianę tekstową; testuj reguły i przepływ. Kontrole i raport 02 według README. Nowe dokładne linki do list zaległości dostarczy plan 06.

## Polecenie do wklejenia

```text
Zaimplementuj plan /Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/02-summary-and-language.md wraz z zasadami README. Zachowaj historię i zgodność backendu, wykonaj kryteria odbioru oraz zapisz raport 02. Nie dodawaj nowych statystyk bez wiarygodnego źródła danych.
```
