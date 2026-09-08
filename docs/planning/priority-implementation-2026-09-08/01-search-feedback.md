# 01 — Wiarygodne wyniki wyszukiwania

Zakres: F03. Zależności: brak. Obowiązują [zasady wspólne](./README.md).

## Rezultat i punkt wejścia

Awaria wyszukiwarki wyświetla błąd z ponowieniem, a poprawne zapytanie bez trafień pokazuje „Brak wyników”. W `apps/web/src/components/GlobalSearch.tsx` błąd obecnie czyści listę; próg zapytania wynosi 2 znaki, debounce 200 ms, limit 20 wyników. Zachowaj te parametry.

Przeczytaj też `components/GlobalSearch.test.tsx` jeśli istnieje, `app/App.regression.test.tsx`, `components/AppShell.tsx` i implementację `search` w store/repozytorium. Nie zakładaj, że nieistniejący plik testu trzeba znaleźć pod taką samą nazwą.

## Zakres implementacji

1. Wprowadź rozłączne stany: puste pole, za krótka fraza, oczekiwanie/szukanie, sukces z wynikami, sukces bez wyników, błąd. Dla jednego znaku komunikat „Wpisz co najmniej 2 znaki”.
2. Dla awarii pokaż „Nie udało się wyszukać. Spróbuj ponownie.” i przycisk „Ponów”. Zachowaj frazę. Retry wykonuje nowe zapytanie dla bieżącej frazy, blokuje duplikowanie żądania podczas trwania.
3. Stara odpowiedź lub błąd nie mogą zastąpić wyniku nowszej frazy, zamkniętego widoku ani innego konta. Zachowaj obecne ignorowanie nieaktualnych odpowiedzi i rozszerz je na retry.
4. Wynik wybiera się strzałkami i Enter. Escape zamyka jak dotąd. Błąd/retry muszą mieć poprawną semantykę poza listą opcji; komunikat dostępny dla czytnika, bez surowych danych diagnostycznych.
5. Ten sam komponent zachowuje się jednakowo w desktopowym nagłówku i mobilnym modalu.

## Odbiór

- [ ] Puste pole nie generuje żądania; jeden znak nie pokazuje „Brak wyników”.
- [ ] Poprawne zero trafień i odrzucone żądanie dają różne komunikaty.
- [ ] Błąd → Ponów → sukces bez utraty frazy; wielokrotne kliknięcie nie mnoży żądań.
- [ ] Opóźnione odpowiedzi dwóch różnych fraz nie zamieniają wyników.
- [ ] Strzałki, Enter, Escape i mobilne zamknięcie działają; nie ma aktywnej opcji wskazującej nieistniejący element.

Testy: kontrolowane odpowiedzi/reject w repozytorium oraz regresja desktop/mobile. Kontrole i raport według README. Bez nowego backendu, paginacji wyników, fuzzy search ani zmiany rankingowania.

## Polecenie do wklejenia

```text
Zaimplementuj plan /Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/01-search-feedback.md wraz z zasadami README w tym katalogu. Wykonaj cały zakres, sprawdź testy i przeglądarkę, zapisz raport 01. Nie kończ na planowaniu ani nie rozszerzaj zakresu.
```
