# Plan 05 — Uproszczenie szczegółu Celu i języka

## Rezultat

Szczegół Celu odpowiada najpierw na pytanie „co zrobić dalej?”, a interfejs używa
spójnie aktualnego języka Projekt–Cel–Działanie–Wiedza.

## Zakres

1. Na górze pokazać następne Działanie, jego główną akcję i szybki wpis postępu.
2. Listę pozostałych Działań zostawić poniżej; relacje Wiedzy per Działanie
   domyślnie zwinąć i pokazywać licznik zamiast pełnego formularza.
3. Kryteria, metadane, edycję i Powiązaną Wiedzę zachować jako sekcje drugorzędne.
4. Zamienić surowe etykiety enumów, np. `decision`, na polskie nazwy domenowe.
5. W aktywnym UI zamienić `Obszar` na `Projekt`; nazwę `area` pozostawić tylko
   w warstwie kompatybilności danych.
6. Oznaczyć stare plany mobilne jako wykonane lub historyczne.

## Kryteria akceptacji

- Następne Działanie i wpis postępu są widoczne bez skanowania całej strony.
- Żadna aktywna ścieżka nie pokazuje `Obszar` ani surowych angielskich enumów.
- Relacje Wiedzy nadal można dodać, edytować i odłączyć klawiaturą oraz mobile.
- Istniejące deep linki i model danych pozostają kompatybilne.

## Weryfikacja

Testy regresji szczegółu Celu, przegląd mobile/desktop i pełne quality gates.

