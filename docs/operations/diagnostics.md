# Diagnostyka pierwszych użytkowników

Frontend ma mały adapter raportowania konfigurowany przez
`VITE_ERROR_REPORTING_ENABLED` i `VITE_ERROR_REPORTING_URL`. Gdy jest włączony,
wysyła POST JSON do wskazanego endpointu. Payload zawiera tylko:

- czas zdarzenia i czas od rozpoczęcia pierwszego przepływu;
- bezpieczną nazwę błędu (`Error`, `TypeError` itp.);
- typ nieudanej operacji (`capture`, `inbox`, `action`, `export` itd.);
- anonimowy etap pierwszego przepływu;
- czasy startu: auth, sesji, Workspace i interaktywności.

Nie wysyłamy wiadomości, stack trace, URL/parametrów trasy, identyfikatorów
Workspace, treści Celów, Działań, Wiedzy ani wartości formularzy. Wysyłka nie
ma sesji, ciasteczek ani nagłówków autoryzacyjnych. Endpoint powinien odrzucać
payloady większe niż oczekiwany kontrakt i przyjmować wyłącznie HTTPS.

Retencja: endpoint monitoringu powinien przechowywać te zdarzenia maksymalnie
30 dni, z automatycznym usunięciem po tym czasie. Dostęp ograniczyć do zespołu
utrzymującego aplikację i nie używać danych do analityki produktowej ani
nagrywania sesji. Wyłączenie: ustaw `VITE_ERROR_REPORTING_ENABLED=false` i
przebuduj frontend; w razie awarii endpointu aplikacja ignoruje błąd wysyłki.

Etap pierwszego przepływu jest trzymany tylko w `sessionStorage` jako anonimowy
znacznik, bez treści użytkownika, i czyszczony przy wylogowaniu.
