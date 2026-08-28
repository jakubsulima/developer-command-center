# Plan 01 — Start i dodawanie bez zbędnego wysiłku

## Rezultat

Po otwarciu aplikacji użytkownik od razu widzi dzisiejsze Działania, a nowe
Działanie może zapisać mobilnie bez osobnego kroku wyboru typu.

## Stan wyjściowy

- Na 390×844 sekcja `Na dziś` zaczyna się poniżej pierwszego ekranu, po kartach
  priorytetu i wielu wyjątkach.
- Mobilne `Dodaj` najpierw pokazuje wybór typu, mimo że Działanie jest domyślne.
- Desktopowy Quick Add już pokazuje pole treści od razu.

## Zakres

1. Ułożyć Start: jeden `Najważniejsze teraz`, następnie `Na dziś`, potem
   zwinięte `Wymaga uwagi` z maksymalnie dwoma pozycjami i licznikiem.
2. Zachować możliwość rozwinięcia pełnej listy wyjątków i istniejące deep linki.
3. Usunąć mobilny stan samego wyboru typu. Po otwarciu ustawić fokus w polu
   Działania; przełączniki Cel/Skrzynka pozostawić dostępne nad polem.
4. Zachować draft, retry, skróty, ustawienia opcjonalne i obsługę klawiatury.
5. Dodać testy regresji dla kolejności Startu i pierwszego fokusu Quick Add.

## Poza zakresem

- Zmiany modelu danych, nowe typy obiektów i AI.
- Przebudowa formularzy Rutyn lub szczegółu Celu.

## Kryteria akceptacji

- Na 390×844 nagłówek `Na dziś` jest widoczny bez przewijania albo po minimalnym
  przewinięciu, również przy wielu wyjątkach.
- `Dodaj` → można od razu pisać Działanie; nie jest wymagany dodatkowy tap.
- Pełna lista wyjątków nadal jest osiągalna i ma prawidłowy licznik.
- Desktop, mobile, klawiatura, loading, error i draft działają jak wcześniej.

## Weryfikacja

`pnpm lint`, `pnpm typecheck`, `pnpm test`, build demo i `pnpm check:bundle`.
Sprawdzić w przeglądarce co najmniej 390×844 oraz desktop.

