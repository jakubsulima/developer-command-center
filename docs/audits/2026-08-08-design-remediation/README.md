# Audyt i poprawki wizualne UI/UX — 2026-08-08

## Zakres

Połączony audyt UX i widocznych ryzyk dostępności dla głównych ekranów aplikacji w trybie demo. Sprawdzone zostały widoki desktop `1440 × 1000` i mobile `390 × 844`, ekrany szczegółów oraz modale szybkiego dodawania i tworzenia Celu. Zmiany dotyczą wyłącznie prezentacji, hierarchii i czytelności; logika domenowa pozostała bez zmian.

## Cel użytkownika

Szybko zrozumieć bieżący kontekst, znaleźć najważniejszą akcję i wykonać ją bez zgadywania, również na małym ekranie i przy obsłudze klawiaturą.

## Najważniejsze problemy i poprawki

1. Akcje w wierszach Dzisiaj i Celu były ukryte do momentu najechania. Teraz pozostają subtelnie widoczne i wzmacniają się przy hoverze lub fokusie.
2. Nagłówki pomocnicze automatycznie zmieniały wielkość każdej litery po spacji. Usunięto sztuczne `capitalize`, zachowując naturalną polszczyznę.
3. Mobilny górny pasek był pusty po lewej. Dodano kompaktową identyfikację Command bez zmiany nawigacji.
4. Główne akcje nagłówków mobile były nieopisanymi ikonami `+`. Przy typowych szerokościach pokazują teraz krótką etykietę, a wariant ikonowy pozostaje wyłącznie dla ekranów poniżej 360 px.
5. Centralna akcja dolnej nawigacji nie miała widocznej nazwy. Dodano etykietę „Dodaj” i poprawiono jej położenie w safe area.
6. Zakładki Inboxu ucinały się poziomo. Na mobile tworzą teraz czytelną siatkę 2 × 2, dzięki czemu każdy stan jest stale widoczny.
7. Szybkie przechwycenie zajmowało zbyt dużo miejsca, a tryby były tylko ikonami. Zmniejszono wysokość i przywrócono etykiety „Tekst” oraz „Link”.
8. Pojedyncza Rutyna wyglądała jak przypadkowo niedokończona kolumna, a część metadanych była zbyt drobna. Karta wykorzystuje teraz rozsądną szerokość, ma czytelniejsze metadane, a jej mobile układa informacje w dwie kolumny.
9. Długie modale ukrywały akcje końcowe poza ekranem. Poszerzono dialogi desktop, zwiększono użyteczną wysokość arkuszy mobile oraz dodano przyklejone nagłówki i stopki.
10. Podsumowanie tygodnia na mobile miało zbyt wąską kolumnę tekstu. Uproszczono wprowadzenie, zwiększono czytelność metadanych i zachowano metryki w zwartej siatce.
11. Surowa data ISO w sekcji Nadchodzące została zastąpiona lokalnym zapisem polskim.
12. Klikalne karty i wiersze mają teraz spójny, wyraźniejszy stan hover/focus bez dodawania dekoracyjnych cieni.

## Kroki audytu i stan po poprawkach

1. **Dzisiaj** — zdrowy; hierarchia zadania, zaległości i następnych działań jest czytelna, a akcje nie są już ukryte.
2. **Projekty** — zdrowy; karty zachowują rytm desktop, a mobile pokazuje opisane główne CTA.
3. **Rutyny** — zdrowy; pojedyncza karta lepiej wykorzystuje przestrzeń, a metadane są czytelniejsze.
4. **Cele** — zdrowy; nagłówki, filtry, karty i mobilne CTA mają spójniejszą hierarchię.
5. **Wiedza** — zdrowy; filtry i wiersze pozostają czytelne, a klikalne powierzchnie mają widoczny stan interakcji.
6. **Inbox** — zdrowy; capture jest lżejszy, a wszystkie stany Inboxu są widoczne bez poziomego zgadywania.
7. **Podsumowanie tygodnia** — zdrowy; opis i rekomendacje mają lepszą szerokość czytania na mobile.
8. **Szczegóły Projektu, Celu i Wiedzy** — zdrowy; zachowano wspólną hierarchię i czytelne powierzchnie interakcji.
9. **Szybkie dodawanie i tworzenie Celu** — zdrowy; kluczowe akcje pozostają widoczne przy przewijaniu na desktop i mobile.
10. **Pusty/niedostępny szczegół Działania** — wizualnie czytelny stan awaryjny; przyczyna niedostępności rekordu jest funkcjonalna i była poza zakresem tej iteracji.

## Dowody

- Zrzuty przed zmianami: [`before/`](./before/)
- Zrzuty po zmianach: [`after/`](./after/)
- Reprezentatywne porównania: [`before/13-inbox-mobile.png`](./before/13-inbox-mobile.png) → [`after/13-inbox-after-mobile.png`](./after/13-inbox-after-mobile.png), [`before/20-new-goal-desktop.png`](./before/20-new-goal-desktop.png) → [`after/17-new-goal-after-desktop.png`](./after/17-new-goal-after-desktop.png)

## Dostępność i ograniczenia dowodów

Widocznie potwierdzono cele dotykowe, stany fokusu, czytelność etykiet i reflow dla dwóch rozmiarów ekranu. Kod zachowuje obsługę `prefers-reduced-motion`. Zrzuty nie potwierdzają pełnej zgodności WCAG ani zachowania wszystkich czytników ekranu; do takiego twierdzenia potrzebne byłyby osobne testy automatyczne i manualne z technologiami asystującymi.

## Weryfikacja

- TypeScript: bez błędów.
- ESLint: bez błędów.
- Testy: 28 plików, 150 testów — wszystkie przeszły.
- Produkcyjny build PWA: zakończony powodzeniem.
