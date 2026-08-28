# Plan 03 — Asystowane przez AI porządkowanie Skrzynki

## Rezultat

AI proponuje sposób przetworzenia elementu Skrzynki, ale użytkownik zatwierdza
lub poprawia wynik przed jakąkolwiek zmianą danych.

## Zależność

Najpierw zakończyć Plan 01, aby AI nie maskowało zbędnej ręcznej złożoności.

## Zakres pierwszej wersji

1. Dla jednego elementu proponować: Cel, Działanie albo Wiedza; opcjonalnie
   powiązany Projekt/Cel, tytuł i termin.
2. Najpierw liczyć deterministyczne fakty i kandydatów, potem przekazywać modelowi
   ograniczony kontekst aktywnych obiektów z tego samego Workspace'u.
3. Zwracać wersjonowany JSON, walidować typy, długości i wszystkie identyfikatory.
4. Pokazać podgląd z akcjami: `Zatwierdź`, `Edytuj`, `Odrzuć`. Brak automatycznych
   mutacji i brak zmian wielu elementów jednym kliknięciem w MVP.
5. Dodać limit, cache, timeout, retry, jawny zakres wysłanych danych i feedback.
6. Przy niskiej pewności proponować pozostawienie w Skrzynce.

## Kryteria akceptacji

- Prompt injection w treści jest traktowany jako dane, nie instrukcja.
- ID spoza allowlisty i niepoprawny JSON są odrzucane.
- Zatwierdzenie używa istniejących typowanych komend i zachowuje Undo/rollback.
- Błąd dostawcy nie blokuje ręcznego triage.
- Testy obejmują trafną propozycję, niepewność, timeout, obce ID i RLS.

## Weryfikacja

Pełne quality gates, test Edge Function oraz mała polska ewaluacja na
zanonimizowanych przykładach. Wdrożenie modelu wymaga checkpointu HITL.

