# Plan 04 — Przechwytywanie offline

## Rezultat

Użytkownik może zawsze zapisać surową treść do Skrzynki; aplikacja synchronizuje
ją po odzyskaniu połączenia bez duplikatów.

## Zakres pierwszej wersji

1. Ograniczyć offline wyłącznie do nowego capture w Skrzynce.
2. Zapisać outbox w IndexedDB z `commandId`, czasem, statusem i liczbą prób.
3. Pokazać stany `zapisano lokalnie`, `oczekuje`, `synchronizacja` i `błąd`.
4. Wysłać komendę po odzyskaniu połączenia, starcie aplikacji i ręcznym retry.
5. Zapewnić idempotencję po stronie Supabase; ponowienie nie tworzy duplikatu.
6. Pozwolić skopiować treść błędnego wpisu. Nie usuwać go automatycznie.

## Poza zakresem

- Offline dla edycji, ukończeń, relacji, AI i plików.
- Złożone rozwiązywanie konfliktów wielu urządzeń.

## Kryteria akceptacji

- Capture zapisany offline przetrwa zamknięcie karty i restart PWA.
- Po synchronizacji powstaje dokładnie jeden element Skrzynki.
- Użytkownik zawsze rozumie, czy dane są lokalne, czy zsynchronizowane.
- Błąd i wielokrotne retry nie powodują utraty treści.

## Weryfikacja

Testy IndexedDB/idempotencji oraz przeglądarkowy scenariusz offline → reload →
online na mobile. Pełne quality gates.

