# Plan podłączenia płatnego OpenAI API

Status: implementacja lokalna ukończona 24 września 2026. Adapter OpenAI,
konfiguracja, atomowy budżet, testy i instrukcja wdrożenia są w repozytorium.
Pozostaje skonfigurować klucz, zastosować migrację i wykonać próby na stagingu;
bez klucza nie wykonano rzeczywistego wywołania OpenAI ani wdrożenia.

## Cel i zakres pierwszego wydania

Podłączyć OpenAI API do istniejących, uruchamianych przez użytkownika funkcji:

1. przeglądu Celów na ekranie tygodnia, z którego korzysta też karta AI na
   Starcie;
2. propozycji klasyfikacji pojedynczego elementu Skrzynki.

Obie funkcje nadal tylko proponują treść. Zapis Działania lub decyzji w Skrzynce
wymaga osobnego działania użytkownika. Tryb demo pozostaje deterministyczny.
Pierwsze wydanie nie dodaje czatu, dostępu do narzędzi ani automatycznych
operacji na danych.

## Punkt wyjścia w kodzie

| Obszar | Stan | Praca przy przejściu na OpenAI |
| --- | --- | --- |
| `supabase/functions/_shared/ai/provider.ts` | Jest interfejs `AIProvider` z wynikiem i zużyciem tokenów. | Zachować kontrakt, dodać adapter OpenAI. |
| `supabase/functions/ai-goal-review/index.ts`, `ai-inbox-triage/index.ts` | Obie funkcje wybierają wyłącznie NVIDIA przez `providerFromEnvironment()`. | Wydzielić wspólny wybór dostawcy, ustawić model osobno dla obu funkcji. |
| `supabase/functions/_shared/ai/*-schema.ts` | Jest walidacja wyniku i dozwolonych identyfikatorów po stronie serwera. | Zachować ją; przygotować osobny schemat zgodny z OpenAI Structured Outputs. |
| `public.ai_runs` | Zapisuje dostawcę, model, tokeny, czas i kod błędu. | Dodać kontrolę kosztu i rozliczanie wszystkich prób, także naprawczych. |
| Cache i limity | Cache uwzględnia hash kontekstu, wersje i model; limity liczą wywołania na dzień. | Dodać dostawcę do klucza cache, atomowy limit wydatku i ochronę przed równoległymi żądaniami. |
| Frontend | Używa stałego kontraktu Edge Function. | Zachować ten kontrakt; ewentualnie dopisać czytelny komunikat o wyczerpaniu budżetu. |

### Rzecz do poprawienia przed płatnym ruchem

Obecny limit działa jako `count → insert`. Dwa równoległe żądania mogą zobaczyć
ten sam licznik i oba wysłać płatne zapytanie. Ponadto `ai_runs` zapisuje tokeny
tylko ostatniej udanej odpowiedzi, choć przegląd Celów może ponowić żądanie po
błędzie lub niepoprawnym JSON. Budżet musi rezerwować maksymalny koszt **przed**
każdą próbą i rozliczać wszystkie wykonane próby, również gdy wynik końcowy
jest błędem.

## Decyzje techniczne

1. **API:** nowy adapter używa `POST /v1/responses`. OpenAI zaleca Responses
   dla nowych integracji. Wysyła `model`, `input`, `max_output_tokens`,
   `text.format` z `json_schema` i `strict: true` oraz jawne `store: false`.
   Adapter pobiera tekst odpowiedzi, identyfikator żądania i `usage`; osobno
   obsługuje odmowę oraz odpowiedź `incomplete`. Nie włącza narzędzi modelu.
2. **Schemat:** bieżący schemat przeglądu ma opcjonalne `draftAction` i
   `uniqueItems`. W ścisłym schemacie OpenAI wszystkie pola obiektu muszą być
   wymagane; `draftAction` ma więc wartość obiekt lub `null`. Kompatybilność
   słów kluczowych trzeba sprawdzić na rzeczywistym żądaniu; unikalność list
   można egzekwować wyłącznie w walidatorze serwera. Po odpowiedzi nadal działa
   obecna walidacja długości, relacji, dat i dozwolonych ID. Przekształcenie
   `null` do dotychczasowego kontraktu UI odbywa się na serwerze.
3. **Modele:** zacząć od `gpt-6-luna` dla Skrzynki i przeglądu Celów.
   Na tych samych przykładach porównać przegląd z `gpt-6-sol`; wybrać Sol tylko
   wtedy, gdy regularnie daje wyraźnie trafniejsze priorytety, uzasadnienia
   oparte na danych lub następne kroki. Nie ma jeszcze pomiaru jakości dla
   tej aplikacji, więc mocniejszy model nie jest domyślnym wymaganiem. Nazwy
   modeli, ceny i dostępność są konfiguracją, nie stałą w kodzie.
4. **Konfiguracja:** `AI_PROVIDER=openai`, `OPENAI_API_KEY` i osobne
   `OPENAI_GOAL_REVIEW_MODEL`/`OPENAI_INBOX_TRIAGE_MODEL` w sekretach funkcji
   Supabase. Klucz powstaje w projekcie OpenAI dla danego środowiska. Nie trafia
   do `VITE_*`, repozytorium ani odpowiedzi HTTP. Dodać te nazwy do
   `supabase/functions/.env.example`; zostawić możliwość powrotu do NVIDIA.
5. **Dane:** kontekst nadal budują RPC działające z JWT użytkownika i RLS.
   Funkcja wysyła tylko ograniczony kontekst potrzebny do danej czynności.
   Zachować zgodę przed pierwszym przeglądem, widoczny zakres analizy oraz
   istniejące retencje wyników. Przed produkcją ustalić wymagania dotyczące
   regionu przetwarzania danych. `store: false` ogranicza przechowywanie stanu
   odpowiedzi, lecz nie jest równoznaczne z brakiem wszystkich logów po stronie
   dostawcy.

## Koszt i limity

Na dzień planu ceny standardowe tekstu wynoszą **$0,10 wejście / $0,50 wyjście**
za 1 mln tokenów dla `gpt-6-luna` oraz **$2 / $10** dla `gpt-6-sol`.
Przykładowe 10 000 tokenów wejścia i 2 000 wyjścia kosztuje odpowiednio około
**$0,002** lub **$0,04** za jedną próbę. To kalkulacja orientacyjna bez
ponowień, cache i narzutów regionalnych; przed wdrożeniem trzeba sprawdzić
aktualny cennik i rzeczywiste `usage` na reprezentatywnych danych.

W aplikacji ustawić dzienny limit kosztu na Workspace i miesięczny limit dla
całego projektu. Rezerwacja w bazie musi być atomowa i konserwatywna: szacowany
koszt wejścia plus maksymalna liczba tokenów wyjścia dla wybranego modelu,
pomnożone przez dopuszczalną liczbę prób. Po odpowiedzi rozliczyć rzeczywiste
zużycie i zwolnić resztę rezerwacji. Gdy brak `usage`, zachować rezerwację do
wyjaśnienia, żeby błąd nie zdejmował ochrony. Zachować dotychczasowy limit
żądań i cooldown `forceRefresh`. Dodać alerty i twardy limit wydatków w
projekcie OpenAI jako drugą barierę.

## Kolejność wdrożenia

1. **Adapter i kontrakt.** Dodać `openai.ts` oraz wspólną fabrykę dostawcy.
   Przetestować request do Responses API, ścisły JSON, mapowanie 401/429/5xx,
   timeout, odmowę, `incomplete` i zużycie tokenów. Nie logować promptu,
   odpowiedzi ani klucza.
2. **Kontrola budżetu.** Dodać migrację z atomową rezerwacją i rozliczeniem
   kosztu per Workspace/projekt; uwzględnić równoległe wywołania oraz próby
   naprawcze. Rozszerzyć `ai_runs` lub osobną tabelę o koszt szacowany i
   rozliczony, z jasno określoną walutą i ceną zastosowaną w chwili żądania.
3. **Przełączenie funkcji.** Podłączyć oba endpointy do wspólnej fabryki i
   zachować kontrakt frontendowy. Rozdzielić konfigurację modelu, limitu
   wyjścia i timeoutu dla dwóch przypadków. Cache identyfikować również
   dostawcą; po zmianie modelu lub promptu nie odczytywać starego wyniku jako
   świeżego.
4. **Staging.** Skonfigurować osobny projekt i klucz OpenAI, sekrety Supabase
   oraz niski budżet. Wykonać zestaw polskich przykładów: krótkie i duże
   portfolio, pusta i niejednoznaczna Skrzynka, obce ID, wstrzyknięcie instrukcji,
   równoległe żądania, cache, limit i awaria dostawcy. Porównać jakość, czas i
   koszt obu modeli na co najmniej 20 zanonimizowanych przykładach na funkcję.
   Sprawdzić JWT, izolację Workspace i brak danych w logach.
5. **Produkcja i wycofanie.** Włączyć OpenAI najpierw dla małego ruchu,
   obserwować `ai_runs`, zużycie projektu OpenAI, błędy i feedback użytkownika.
   W razie problemu wyłączyć pojedynczą funkcję istniejącym kill switchem lub
   wrócić do NVIDIA przez `AI_PROVIDER`; zmiana sekretu nie wymaga przebudowy
   PWA. Zaktualizować README i instrukcję wdrożenia po pozytywnym odbiorze.

## Kryteria odbioru

- Przegląd Celów i propozycja Skrzynki działają przez OpenAI na stagingu,
  zachowując obecny format odpowiedzi i jawne zatwierdzanie zmian.
- Żądanie bez JWT i próba użycia obcego Workspace nie wywołują OpenAI.
- Niepoprawna, niepełna lub odrzucona odpowiedź nie zapisuje propozycji jako
  gotowej; użytkownik dostaje kontrolowany błąd.
- Równoległe wywołania i ponowienia nie przekraczają skonfigurowanego budżetu
  aplikacji; każda próba jest uwzględniona w kosztach.
- Na zestawie ewaluacyjnym nie ma obcych ID ani propozycji zapisu bez akceptacji;
  użytkownik porównuje oba modele na tych samych danych i ocenia trafność
  priorytetów, konkretność następnego kroku oraz język przed wyborem modelu
  produkcyjnego.
- Klucz występuje wyłącznie w sekretach Edge Function. W logach i bazie nie ma
  pełnego promptu ani surowej odpowiedzi.
- Demo, cache, `forceRefresh`, feedback, karta Start i formularz ręcznego
  Działania przechodzą regresję; `pnpm lint`, `pnpm typecheck` i `pnpm test`
  przechodzą.

## Źródła aktualnych wymagań

- [OpenAI: migracja do Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [OpenAI: Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI: ceny API](https://developers.openai.com/api/docs/pricing)
- [OpenAI: dane i retencja](https://developers.openai.com/api/docs/guides/your-data)
- [OpenAI: praktyki produkcyjne](https://developers.openai.com/api/docs/guides/production-best-practices)
- [Supabase: sekrety Edge Functions](https://supabase.com/docs/guides/functions/secrets)
