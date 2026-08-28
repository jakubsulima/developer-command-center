# Plan 02 — Gotowość dla pierwszych realnych użytkowników

## Rezultat

Nowy użytkownik przechodzi od rejestracji do pierwszego ukończonego Działania,
a awarie produkcyjne można zauważyć i bezpiecznie zdiagnozować.

## Zakres

1. Sprawdzić pusty Workspace i zbudować jedną ścieżkę pierwszej minuty:
   przechwyć → utwórz Działanie → zobacz na Starcie → ukończ.
2. Nie pokazywać pełnego touru modułów przed pierwszym użytecznym wynikiem.
3. Przeprowadzić E2E na staging Supabase: rejestracja/logowanie, zapis, reload,
   drugi browser, synchronizacja, eksport i ponowne logowanie.
4. Podłączyć produkcyjne raportowanie błędów przez mały adapter. Nie wysyłać
   treści Celów, Działań, Wiedzy ani danych formularzy.
5. Rejestrować tylko czasy startu, typ nieudanej operacji i anonimowy etap
   pierwszego przepływu; opisać retencję i możliwość wyłączenia.
6. Udokumentować procedurę rollbacku frontendu, migracji i Edge Function.

## Poza zakresem

- Zespoły, role, współdzielenie Workspace'u i płatności.
- Rozbudowana analityka produktowa lub nagrywanie sesji.

## Kryteria akceptacji

- Świeże konto osiąga pierwsze ukończone Działanie bez danych demo.
- Dane są widoczne po ponownym logowaniu i w drugim browserze.
- Błąd testowy trafia do monitoringu bez treści użytkownika.
- Eksport działa, a rollback ma sprawdzoną instrukcję.
- Wyniki staging E2E są zapisane w krótkim raporcie z datą.

## Weryfikacja

Pełne lokalne quality gates oraz ręczny checkpoint HITL na staging. Nie wdrażać
na produkcję bez potwierdzenia użytkownika.

