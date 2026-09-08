# 09 — Odbiór całego przepływu na realnym koncie

Zakres: Q01. Dwa momenty realizacji: przygotowanie przed zmianą backendu oraz odbiór po gotowym pakiecie. Obowiązują [zasady wspólne](./README.md).

## Rezultat i źródła

Powstaje aktualny raport wskazujący, które funkcje działają na rzeczywistym środowisku testowym, a co jest tylko gotowe lokalnie. Nie jest to automatyczne zlecenie publikacji produkcji.

Przeczytaj `docs/testing/staging-e2e-2026-08-27.md`, instrukcje `docs/deployment`, bieżące migracje i raporty planów 01–08. Raport sierpniowy opisuje dawną rozbieżność migracji; nie traktuj jej jako potwierdzonej dzisiejszej awarii.

## A. Przygotowanie — przed pierwszą zmianą backendu

1. Ustal z dostępnej konfiguracji nazwę środowiska testowego, wersję frontendu i migracji; nie wyświetlaj sekretów. Sprawdź, że celem nie jest produkcja.
2. Wykonaj dozwolony odczyt aktualnej historii migracji i porównaj z repo. Przy rozbieżności zapisz konkretne wersje i proponowaną procedurę; nie wykonuj repair/push/pull zmieniającego stan na podstawie starego raportu.
3. Sprawdź dostępność konta testowego i odseparowanego Workspace. Jeżeli brakuje adresu środowiska lub konta, poproś o ten konkretny element, nie o hasło w wiadomości/repo. Najpierw przygotuj dostępne lokalnie scenariusze i skrypty.
4. Przygotuj plan wydania: migracje wymagane przez pakiet, kompatybilność starego frontendu, kolejność migracja → frontend → smoke test oraz procedurę powrotu. Dla zmian addytywnych preferuj rollback frontendu bez kasowania nowych danych.

## B. Scenariusze odbioru

Używaj wyłącznie testowych treści, np. prefiksu `E2E-<data>`. Dwa urządzenia mogą być dwoma niezależnymi kontekstami przeglądarki, ale nie opisuj ich jako testu prawdziwego telefonu. Wykonuj testy zmieniające zdalne dane w uzgodnionej przestrzeni testowej. Jeśli potrzebne jest udostępnienie przygotowanej wersji/migracji na staging, przedstaw gotowy zakres i zastosuj istniejące upoważnienie lub uzyskaj osobne zlecenie przed wdrożeniem.

| Scenariusz | Oczekiwany wynik |
| --- | --- |
| Login i pierwsze użycie | Pusty Workspace bez automatycznego demo; capture → triage → Działanie → ukończenie. Rejestrację zweryfikuj, jeśli jest wspierana przez aktualną konfigurację kont. |
| Trwałość | Reload i ponowne logowanie zachowują wynik. |
| Wyszukiwanie (01) | Wynik jest odnajdywany; zasymulowana awaria i zero wyników mają różne stany. |
| Podsumowanie (02) | Bieżące metryki zgadzają się z zapisami, bez Focus; historyczny eksport pozostaje czytelny. |
| Draft (03) | Nawigacja/reload zachowują wpis; drugie konto nie widzi szkicu pierwszego. |
| Mobile (04) | 390×844 oraz dostępny realny telefon: kontekst, wpis postępu, klawiatura, zapis i powrót. |
| Lista (05) | Samodzielny krok bez daty, filtry i rekord spoza pierwszej strony są osiągalne; powrót zachowuje pozycję. |
| Zaległości (06) | Przełożenie/anulowanie/ukończenie i undo działają, pojedyncza Rutyna nie zmienia serii. |
| Dwa klienty (07) | A zmienia dane, B odświeża; własny draft i pending writes nie przepadają. |
| Konflikt | A i B edytują ten sam rekord; starsza wersja nie nadpisuje nowej po cichu. |
| Offline (08, jeśli w pakiecie) | Offline → restart → online i utracona odpowiedź dają jeden wpis. Przy pominięciu planu oznacz N/D z powodem. |
| Izolacja dostępu | Konto B nie odczytuje/nie zmienia danych A; użyj kontrolowanego testu w staging, bez obcych rzeczywistych danych. |
| Eksport | Plik JSON pobiera się i zawiera testowe dane/relacje oraz dostępne rekordy historyczne. To nie jest test importu. |
| Monitoring | Kontrolowany błąd ma identyfikator zdarzenia i bezpieczny payload; treść notatek/formularzy nie trafia do monitoringu. |
| Odtwarzanie | Procedura powrotu frontendu jest sprawdzona na testowym środowisku w dozwolonym zakresie; ścieżka odzyskania bazy jest opisana, a wykonane próby odnotowane osobno. |

## Odbiór i raport

- [ ] Każdy scenariusz ma PASS/FAIL/N/D/NIE WYKONANO, datę, wersję i krótki dowód.
- [ ] Raport nie zawiera haseł, kluczy ani prywatnego eksportu; usuń dane identyfikujące z logów i screenshotów.
- [ ] Lista blokad rozróżnia usterkę kodu, brak dostępu, niewdrożoną migrację i niewykonany test urządzenia.
- [ ] Błędy w zakresie pakietu są naprawione i ponownie sprawdzone; niezwiązane problemy mają osobny wpis, bez niekontrolowanego rozszerzania prac.
- [ ] Nie uznano testów demo za dowód działania produkcji. Brak stagingu nie pozwala nadać pakietowi pełnego PASS.

Raport: `docs/testing/priority-2026-09-08/09-report.md`. Dodaj krótką checklistę publikacji z listą dokładnych artefaktów i wymaganych działań; nie publikuj bez zlecenia. Do sprzątania korzystaj z odwracalnych ścieżek testowego produktu; permanentne usuwanie danych poza zakresem tego planu.

## Polecenie do wklejenia

```text
Wykonaj plan /Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/09-staging-acceptance.md wraz z README. Sprawdź aktualny stan testowego środowiska i raporty gotowych planów, wykonaj dostępne E2E oraz zapisz raport 09. Nie uznawaj brakujących testów za PASS i nie wdrażaj ani nie naprawiaj zdalnych migracji bez osobnego zlecenia. Braki dostępu opisz konkretnie po wykonaniu dostępnych prac.
```
