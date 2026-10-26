# Szybki zapis i dobrowolne przypomnienia

Kod przygotowano lokalnie 25 października 2026. Migracje bazy zastosowano 26 października 2026 w projekcie Supabase `command` (`khlhhwfsxfxffawlghxh`), łącznie z zaległymi migracjami od `20260927195000` oraz korektą deklaracji funkcji kontekstu AI. Potwierdzono historię migracji, RLS nowych tabel i ograniczenia dostępu do nowych RPC. Wysyłka push pozostaje niewdrożona: wymaga funkcji, kluczy VAPID i harmonogramu opisanych poniżej. Szybki zapis działa bez konfiguracji push; przypomnienie jest domyślnie wyłączone.

## Kolejność wdrożenia

1. Sprawdź listę oczekujących migracji w docelowym projekcie. Nowa migracja to `20261024175333_easy_capture_and_reminders.sql`; zależy także od wcześniejszych migracji tego repozytorium. Zastosuj sprawdzony zestaw przed wdrożeniem frontendu. Nie uruchamiaj wszystkich lokalnych migracji bez przeglądu ich zakresu.
2. Wygeneruj jedną parę VAPID, np. narzędziem `web-push@3.6.7 generate-vapid-keys --json`, w zaufanym lokalnym terminalu. Przechowaj prywatny klucz jako sekret; nie wklejaj go do repozytorium ani rozmowy. Zachowaj tę samą parę między wdrożeniami — zmiana wymaga ponownego zapisania subskrypcji.
3. Ustaw sekrety funkcji: `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` (prawdziwy kontakt `mailto:` administratora), `RETURN_REMINDERS_CRON_SECRET` (losowy sekret o długości co najmniej 32 znaków), `RETURN_REMINDERS_ENABLED=false`. `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` zapewnia środowisko Supabase; klucza administracyjnego nie dodawaj do frontendu.
4. Wdróż funkcję `send-return-reminders`. Konfiguracja `verify_jwt=false` jest celowa: funkcja samodzielnie weryfikuje dedykowany sekret harmonogramu, odrzuca brak autoryzacji i obsługuje tylko POST. Nie używa klucza anon jako autoryzacji wysyłki.
5. W Supabase Vault dodaj `command_reminder_url` z adresem HTTPS tej funkcji oraz `command_reminder_token` z wartością identyczną z `RETURN_REMINDERS_CRON_SECRET`. Uruchom [skrypt harmonogramu](return-reminders.sql) jako administrator. Powtórne uruchomienie zastępuje zadanie o tej samej nazwie.
6. Ustaw publiczną zmienną frontendu `VITE_WEB_PUSH_PUBLIC_KEY` identyczną z kluczem publicznym serwera i zbuduj aplikację. PWA importuje `/push-handler.js`; testuj build produkcyjny, ponieważ zwykły serwer Vite nie uruchamia docelowego service workera.
7. Po sprawdzeniu konfiguracji ustaw `RETURN_REMINDERS_ENABLED=true`. Dopiero użytkownik wybiera dni, porę, strefę i urządzenie w Ustawieniach. Konfiguracja serwera nie zapisuje nikogo na powiadomienia.

## Zachowanie i ograniczenia

Preferencja jest chroniona RLS i przypisana do użytkownika oraz przestrzeni. Każda para ma jeden harmonogram i jedno wybrane urządzenie. Zapis na innym urządzeniu zastępuje subskrypcję. Eksport obejmuje preferencje, pomijając endpoint i klucze subskrypcji.

Cron sprawdza harmonogram co minutę. Okno wysyłki wynosi 10 minut, TTL 60 sekund, dzierżawa próby 3 minuty, najwyżej trzy próby na lokalną datę. Klucz dzienny nie zmienia się przy zmianie urządzenia w tym samym dniu; ogranicza to podwójne przypomnienia. Zmiana czasu nie tworzy drugiego wpisu dostarczenia dla tej samej daty. Zaległe dni nie są nadrabiane. Partie mają do 100 pozycji i pięć równoległych żądań; poprzednio obsłużone pozycje nie blokują następnej partii.

Serwer ponownie sprawdza aktywność ustawienia i członkostwo przed wysyłką. Kieruje żądania tylko do obsługiwanych usług Apple, Google i Mozilla, bez podążania za przekierowaniami. Odpowiedzi 404/410 wygaszają subskrypcję. Powiadomienie zawiera wyłącznie ogólny tekst i lokalną trasę, bez treści wpisu. Wylogowanie odłącza przypomnienie urządzenia; jeśli serwer nie potwierdzi odłączenia, aplikacja pokazuje błąd zamiast obiecywać jego wykonanie.

Sukces usługi push oznacza przyjęcie żądania, nie odczytanie przez użytkownika. Awaria między wysyłką a zapisem wyniku może spowodować ponowienie; nie obiecujemy dokładnie jednej dostawy. Stały tag powiadomienia ogranicza mnożenie kart. System iPhone’a, tryb Skupienie i stan sieci mogą wpływać na prezentację. Wyłączenie nie cofa już wysłanego powiadomienia.

## Odbiór na rzeczywistym iPhonie

Sprawdź instalację z Safari na ekranie początkowym, zimny start `/capture`, logowanie z zachowaniem trasy i dostępność przycisku Zapisz nad klawiaturą. Następnie świadomie włącz przypomnienie na najbliższą porę: odbierz je przy zamkniętej aplikacji, otwórz obie trasy docelowe, wyłącz harmonogram, cofnij zgodę systemową i wyloguj konto. Zmiana konta nie może uruchamiać powiadomień poprzedniego użytkownika. Sprawdź także zastąpienie urządzenia i brak nadrabiania po przerwie.

Testy lokalne obejmują izolację RLS, idempotencję zapisu, konflikt cofnięcia, filtrowanie przed paginacją, łączenie statusu i daty, dzienną deduplikację oraz zmianę czasu. Testy Deno sprawdzają autoryzację, wyłącznik wysyłki i rzeczywiste szyfrowanie Web Push bez wysyłania żądań. Podgląd mobilny w przeglądarce nie zastępuje odbioru powiadomień na telefonie.

Awaryjne zatrzymanie: ustaw `RETURN_REMINDERS_ENABLED=false` i wyłącz zadanie `command-return-reminders` w Cron. Nie usuwaj tabel ani danych użytkowników.

Dokumentacja źródłowa: [Supabase — harmonogram funkcji](https://supabase.com/docs/guides/functions/schedule-functions), [WebKit — Web Push na iOS](https://webkit.org/blog/13878/), [web-push](https://github.com/web-push-libs/web-push).
