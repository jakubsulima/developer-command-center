# Instrukcje dla agentów

## Odstępy w interfejsie

Stosuj siatkę 8 px w nowym i modyfikowanym kodzie interfejsu. Ustawiaj `margin`, `padding`, `gap` oraz odstępy pozycjonowania na 0 lub wielokrotność 8 px. Typowe wartości to 8, 16, 24 i 32 px.

Rozmiary tekstu i ikon, grubości obramowań, minimalne pola dotyku oraz marginesy bezpiecznego obszaru dobieraj według ich funkcji.

## Etykiety w interfejsie

Dodawaj widoczny tekst, gdy pomaga zrozumieć treść lub wykonać akcję. Przy powtarzalnych akcjach w wierszach list unikaj zbędnych napisów obok rozpoznawalnych ikon, np. „Podgląd”. Zachowuj dostępną nazwę przycisku ikonowego, a w menu nazywaj akcje wprost.

## Komponenty wielokrotnego użytku

Przed dodaniem elementu interfejsu sprawdź wspólne komponenty i istniejące wzorce w aplikacji. Korzystaj z nich wszędzie, gdzie pasują do potrzeb widoku. Gdy brakuje wariantu, w pierwszej kolejności użyj kompozycji lub rozszerz wspólny komponent, zachowując zachowanie dotychczasowych widoków. Wydzielaj nowy wspólny komponent, gdy ten sam wzorzec pojawia się w kilku miejscach.
