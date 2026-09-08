# 08 — Trwałe przechwytywanie offline do Skrzynki

Zakres: F07, opcjonalny etap pakietu. Zależności: 03, 07. Obowiązują [zasady wspólne](./README.md).

## Rezultat i źródła

Na wcześniej uruchomionej aplikacji użytkownik zapisuje tekst/link bez sieci, zamyka kartę i po ponownym otwarciu odzyskuje wpis. Po zalogowaniu do tego samego konta i odzyskaniu sieci powstaje dokładnie jeden element Skrzynki.

Punkty wejścia: `components/CaptureComposer.tsx`, `components/QuickAdd.tsx`, `pages/InboxPage.tsx`, `domain/capture.ts`, `domain/commands.ts`, `data/localWorkspaceRepository.ts`, `data/workspaceRepository.ts`, adapter Supabase, auth, store i `vite.config.ts`. Poprzednia specyfikacja: `docs/planning/plan-04-offline-capture.md`. Lokalny tryb demo w IndexedDB nie jest outboxem zdalnego konta.

## Zakres

1. Offline dotyczy wyłącznie nowego surowego tekstu/linku do Skrzynki. Bez edycji, ukończeń, relacji, plików i AI. Quick Add offline pokazuje jasno, co można zapisać; nie udaje sukcesu zwykłego Działania.
2. Outbox IndexedDB zawiera wersję formatu, tożsamość właściciela/przestrzeni, payload, stabilny commandId/idempotencyKey, czas utworzenia, status, liczbę prób i ostatni bezpieczny błąd. Sukces lokalny dopiero po zatwierdzeniu transakcji IndexedDB.
3. Kolejka widoczna w Skrzynce i zwięzły licznik w shellu: zapisano na urządzeniu/oczekuje/wysyłanie/błąd. Element wysłany zastępuje się kanonicznym rekordem, bez duplikatu optymistycznego. Awaria pamięci pokazuje błąd i zachowuje pole do skopiowania.
4. Flush po odzyskaniu sieci, starcie aplikacji i ręcznym ponowieniu; limitowane retry z backoffem, brak gorącej pętli. Offline rozpoznawaj także po błędzie rzeczywistego żądania, nie tylko `navigator.onLine`.
5. Identyczny commandId jest używany po timeout, restarcie i równoczesnym wysłaniu z dwóch kart. Backend idempotentnie wiąże klucz z autoryzowanym Workspace i intencją. Test najważniejszego przypadku: serwer zapisał, odpowiedź zginęła, retry nie tworzy drugiego wpisu.
6. Dwie karty koordynują wysyłkę; blokada/lease musi odzyskać się po awarii karty. Idempotencja backendu jest ostateczną ochroną. Awaria po odpowiedzi serwera, ale przed usunięciem outboxu również nie dubluje danych.
7. Wygasła sesja wstrzymuje wysyłkę i prosi o ponowne logowanie; 403/utrata dostępu zatrzymuje automatyczne retry. Nie przepinaj wpisów do innego konta lub Workspace. Właściciel może skopiować niesynchronizowaną treść.
8. Zachowanie przy wylogowaniu: zatrzymać wysyłkę, ukryć i odizolować kolejkę; przed wylogowaniem poinformować o oczekujących wpisach. Jeżeli istniejąca polityka wymaga czyszczenia pamięci, zapewnić jawne odzyskanie/eksport przed odrzuceniem — nie kasować po cichu.
9. Sprawdź start cached PWA bez sieci oraz bramkę auth. Nie da się obiecać pierwszego uruchomienia na zupełnie nowym urządzeniu offline. Rozdziel dostęp do lokalnej kolejki od autoryzacji wysłania na serwer. Aktualizacja service workera nie może wyczyścić outboxu.

## Odbiór

- [ ] Offline → capture → zamknięcie → restart → treść widoczna właścicielowi.
- [ ] Online → jeden rekord serwera, jeden element UI, kolejka rozliczona.
- [ ] Utracona odpowiedź, dwie karty i restart w połowie flush nie tworzą duplikatu.
- [ ] Błąd IndexedDB nie pokazuje fałszywego sukcesu; treść można skopiować.
- [ ] Zmiana konta/utrata sesji/uprawnień nie wysyła wpisu do niewłaściwej przestrzeni i nie kasuje go po cichu.
- [ ] Zwykłe mutacje offline nie udają wspieranych; ręczny capture online działa jak wcześniej.

Testy IndexedDB, granic awarii i idempotencji SQL, przegląd produkcyjnego builda PWA offline/reload/online. Staging i prawdziwy telefon przy dostępności. Kontrole i raport 08 według README. Bez zdalnego wdrożenia z samego polecenia implementacji.

## Polecenie do wklejenia

```text
Zaimplementuj opcjonalny plan /Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/08-offline-capture.md wraz z README, po planach 03 i 07. Dostarcz outbox, UI, zgodny backend i test utraconej odpowiedzi/dwóch kart. Sprawdź produkcyjny build PWA, przygotuj migracje lokalnie i zapisz raport 08.
```
