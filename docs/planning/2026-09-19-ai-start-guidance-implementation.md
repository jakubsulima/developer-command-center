# Kierunek od AI na ekranie Start — plan wdrożenia

Data: 2026-09-19. Status: wdrożone lokalnie, gotowe do odbioru.

## Cel

Zastąpić sekcję `Dalszy plan` na ekranie Start kompaktowym podsumowaniem AI,
które pomaga odpowiedzieć na trzy pytania:

1. Jaka jest obecna sytuacja aktywnych Celów?
2. Na czym użytkownik powinien skupić się teraz?
3. Jaki konkretny następny krok może wykonać w aplikacji?

Zmiana ma wykorzystywać istniejący `AIGoalReview`, jego cache, zgodę użytkownika,
obsługę błędów i zapisane rekomendacje. MVP nie dodaje nowego endpointu, tabeli,
migracji ani automatycznej analizy w tle.

## Punkt wyjścia

- `StartPage.tsx` pokazuje kolejno `Najważniejsze teraz`, `Na dziś` i zwinięty
  `Dalszy plan` z horyzontem siedmiu dni, aktywnością tygodnia i wyjątkami.
- `Najważniejsze teraz` jest regułową rekomendacją z `deriveHomeSummary` i działa
  bez AI. Powinno pozostać niezawodnym wyborem jednej pilnej rzeczy.
- `AIGoalReview` na ekranie podsumowania tygodnia potrafi już wygenerować oraz
  odczytać zapisany wynik, oznaczyć go jako nieaktualny, ponowić analizę,
  utworzyć Działanie po zatwierdzeniu i zebrać ocenę rekomendacji.
- Zakres istniejącej analizy obejmuje aktywne Cele, ich kryteria, powiązane
  Działania, blokady i ostatnie wpisy postępu z 28 dni. Nie obejmuje całej
  Wiedzy ani pełnej Skrzynki, więc interfejs nie może sugerować pełnej analizy
  workspace'u.
- Najnowszy zapisany przegląd jest ładowany przy inicjalizacji store'u. Start
  może go wyświetlić bez nowego wywołania modelu.

## Kontrakt produktu

### Role trzech sekcji Startu

| Sekcja | Odpowiada na pytanie | Źródło |
| --- | --- | --- |
| `Najważniejsze teraz` | Co wymaga jednej pilnej decyzji? | reguły lokalne, zawsze dostępne |
| `Na dziś` | Co mam dzisiaj wykonać? | zaplanowane i przypięte Działania |
| `Kierunek od AI` | Co wynika z szerszego obrazu aktywnych Celów? | ostatni `AIGoalReview` |

AI nie powinno kopiować tytułu z `Najważniejsze teraz` bez dodania szerszego
uzasadnienia. Jeśli obie sekcje wskazują ten sam obiekt, karta AI pokazuje
wpływ na Cel, sygnały i proponowany następny krok.

### Docelowa zawartość karty

W stanie gotowym karta pokazuje:

- nagłówek `Kierunek od AI` i stan portfela Celów;
- `headline` oraz skrócone `summary` ostatniego przeglądu;
- jedną główną rekomendację: tytuł, `suggestedNextStep` i maksymalnie trzy
  czytelne sygnały;
- główne CTA prowadzące do Działania albo Celu, lub otwierające zatwierdzenie
  szkicu Działania;
- link `Zobacz pełną analizę` do `/review`;
- czas wygenerowania i stan aktualności;
- zwijane `Sygnały i dalszy plan`, zachowujące użyteczne fakty z obecnej sekcji:
  nadchodzące Działania, aktywność tygodnia i elementy wymagające uwagi.

Na telefonie karta ma pokazywać bez rozwijania tylko podsumowanie, jeden krok,
jedno główne CTA i link do pełnej analizy. Szczegóły oraz liczby pozostają
zwinięte.

### Wybór głównej rekomendacji

Wprowadzić czystą funkcję domenową, bez zależności od Reacta:

1. pierwsza rekomendacja z `horizon: "now"`;
2. w przeciwnym razie pierwsza z `horizon: "this_week"`;
3. w przeciwnym razie pierwsza dostępna rekomendacja;
4. przy pustej liście wyświetlić tylko `headline`, `summary` i pełną analizę.

Kolejność wewnątrz tego samego horyzontu pozostaje kolejnością modelu.
Nie sortować po `confidence`, ponieważ pewność nie jest priorytetem działania.

CTA wybiera się jawnie:

1. jeśli istnieje `draftAction`, pokaż `Dodaj proponowane Działanie` i wymagaj
   edycji lub zatwierdzenia w istniejącym modalu;
2. w przeciwnym razie, jeśli rekomendacja wskazuje istniejące Działanie,
   pokaż `Otwórz Działanie`;
3. w przeciwnym razie pokaż `Przejdź do Celu`;
4. brak dostępnego obiektu nie może tworzyć martwego przycisku — zostaje link
   do pełnej analizy.

## Stany interfejsu

### 1. Brak wcześniejszej analizy

- Tekst: `AI może podsumować aktywne Cele i wskazać następny krok.`
- CTA: `Przeanalizuj moje Cele`.
- Kliknięcie otwiera obecną zgodę opisującą zakres wysyłanych danych.
- Bez aktywnego Celu CTA jest nieaktywne, a karta prowadzi do utworzenia Celu.
- Samo wejście na Start nie wywołuje dostawcy AI.

### 2. Ładowanie lub odświeżanie

- Zachować poprzedni wynik podczas odświeżania.
- Dodać nieblokującą etykietę `Odświeżam analizę…`.
- Przy pierwszym uruchomieniu pokazać kompaktowy skeleton/status bez zmiany
  wysokości całego ekranu.

### 3. Wynik aktualny

- Pokazać zawartość opisaną w kontrakcie produktu.
- `Odśwież` jest akcją drugorzędną i korzysta z istniejącego limitu oraz cache.
- Ocena `Pomocne / Niepomocne` dotyczy wyświetlonej rekomendacji i korzysta
  z obecnego `submitGoalReviewFeedback`.

### 4. Wynik nieaktualny

- Poprzedni wynik pozostaje widoczny.
- Widoczna informacja: `Dane Celów zmieniły się od tej analizy.`
- CTA związane z istniejącym obiektem może działać, ale utworzenie szkicu
  Działania wymaga sprawdzenia, że Cel nadal istnieje i jest aktywny.
- Przycisk `Odśwież` nie może obchodzić pięciominutowego cooldownu.

### 5. Błąd

- Jeśli istnieje poprzedni wynik, zachować go i pokazać błąd odświeżenia.
- Bez wyniku wyświetlić krótki komunikat i `Spróbuj ponownie`, poza błędami
  `AI_NOT_CONFIGURED` i `NO_ACTIVE_GOALS`.
- Poniżej zawsze pozostają regułowe `Najważniejsze teraz`, `Na dziś` oraz
  zwijane sygnały systemowe. Awaria AI nie może blokować Startu.

## Architektura zmian

### Nowe elementy

1. `apps/web/src/domain/aiStartGuidance.ts`
   - wybór głównej rekomendacji;
   - rozwiązanie docelowego Celu/Działania;
   - mapowanie horyzontu, statusu i sygnałów na tekst UI;
   - wynik jawnie reprezentujący brak dostępnego CTA.
2. `apps/web/src/components/AIStartGuidance.tsx`
   - kompaktowa karta i wszystkie jej stany;
   - połączenie z `useStore`;
   - otwieranie zgody, odświeżanie, feedback i zatwierdzenie szkicu;
   - przyjmuje `homeSummary`, aby wyświetlić obecne sygnały bez ponownego
     liczenia domeny.
3. `apps/web/src/components/AIGoalReviewShared.tsx` lub równoważne małe moduły
   - współdzielony modal zgody;
   - współdzielony modal szkicu Działania;
   - wspólne teksty błędów, humanizacja referencji i etykiety sygnałów.

Nie tworzyć jednego dużego komponentu obsługującego jednocześnie pełny ekran
tygodnia i kartę Start. Współdzielić zachowanie i małe elementy, pozostawiając
dwie osobne prezentacje.

### Zmiany istniejących plików

- `StartPage.tsx`: zastąpić `start-overview` komponentem `AIStartGuidance`.
- `AIGoalReview.tsx`: użyć współdzielonych modali i mapperów bez zmiany
  zachowania pełnego przeglądu.
- `aiGoalReview.ts`: pozostawić kontrakt API bez zmian; dodać typy pomocnicze
  tylko wtedy, gdy są wspólne dla obu widoków.
- `styles.css`: dodać style karty Start, stanów aktualności, sygnałów i mobile;
  usunąć stare style dopiero po potwierdzeniu, że nie są używane.
- `App.regression.test.tsx`: zastąpić oczekiwania dotyczące `Dalszego planu`
  scenariuszami nowej karty.
- `AIGoalReview.test.tsx`: utrzymać regresję zgody, odświeżenia, feedbacku i
  zatwierdzania szkicu po wydzieleniu części wspólnych.

Store, repozytoria, Edge Function i baza pozostają bez zmian w MVP.

## Etapy wdrożenia

### Etap 1 — selektor domenowy i prezentacja bez mutacji `AFK`

**Zakres**

- Dodać `selectAIStartGuidance` z deterministycznym wyborem rekomendacji.
- Zbudować kartę dla gotowego i nieaktualnego wyniku.
- Dodać linki do istniejącego Działania, Celu i pełnego przeglądu.
- Zachować obecny `Dalszy plan` jako zwijane `Sygnały i dalszy plan` wewnątrz
  nowej sekcji.
- Nie podłączać jeszcze generowania, feedbacku i tworzenia Działania.

**Odbiór**

- Użytkownik z zapisanym przeglądem widzi jeden kierunek i jeden następny krok.
- Na telefonie główna treść mieści się przed dolną nawigacją bez poziomego
  przepełnienia.
- Brak rekomendacji oraz brakujące referencje nie powodują pustego CTA ani
  błędu renderowania.

### Etap 2 — zgoda, generowanie i wszystkie stany `AFK + HITL copy`

**Zakres**

- Wydzielić współdzielony modal zgody i komunikaty błędów.
- Podłączyć `requestGoalReview`, `loading`, `refreshing`, `error` i retry.
- Zachować poprzedni wynik podczas odświeżania.
- Dodać znacznik czasu, aktualność i ręczne odświeżenie.
- Uzgodnić finalne nazwy: rekomendowane `Kierunek od AI` oraz
  `Sygnały i dalszy plan`.

**Odbiór**

- Pierwsze wywołanie AI zawsze wymaga obecnej zgody.
- Powrót na Start pokazuje zapisany wynik bez ponownego wywołania modelu.
- Błąd, limit i brak konfiguracji nie ukrywają systemowych danych Startu.
- Pełny przegląd na `/review` zachowuje dotychczasową funkcjonalność.

### Etap 3 — działanie z rekomendacji i feedback `AFK`

**Zakres**

- Wydzielić i wykorzystać modal zatwierdzenia `draftAction`.
- Przed zapisem sprawdzić istnienie i aktywność Celu.
- Po zatwierdzeniu dodać Działanie jako przypięte na dziś, używając obecnego
  `createAction` i komunikatu sukcesu.
- Podłączyć ocenę rekomendacji.
- Nie wykonywać żadnej mutacji bez wyraźnego zatwierdzenia użytkownika.

**Odbiór**

- Szkic można edytować, anulować i zatwierdzić.
- Błąd zapisu zachowuje treść formularza.
- Sukces aktualizuje `Na dziś`, oznacza analizę jako nieaktualną i nie tworzy
  duplikatu po podwójnym kliknięciu.
- Feedback dotyczy dokładnie rekomendacji pokazanej na Start.

### Etap 4 — odbiór mobilny i wydanie `HITL`

**Zakres**

- Sprawdzić szerokości 320, 390 i desktop.
- Przejść pełny scenariusz w demo i Supabase.
- Ocenić na rzeczywistych danych, czy karta nie powtarza
  `Najważniejsze teraz` oraz czy zakres analizy jest zrozumiały.
- Włączyć zmianę bez modyfikacji backendu; w razie potrzeby umożliwić szybki
  powrót do starej sekcji małym lokalnym feature flagem.

**Odbiór**

- Na Start w ciągu kilku sekund wiadomo, co zrobić i dlaczego.
- Główne CTA ma co najmniej 44 px wysokości i czytelną nazwę dla czytnika.
- Obsługa klawiaturą obejmuje rozwinięcie sygnałów, odświeżenie, feedback,
  zgodę oraz modal szkicu.
- Fokus wraca do elementu otwierającego po zamknięciu modalu.

## Testy

### Jednostkowe

- priorytet `now` → `this_week` → pierwszy dostępny;
- pusta lista rekomendacji;
- wybór `draftAction`, Działania, Celu i braku CTA;
- nieistniejące lub nieaktywne referencje;
- mapowanie znanych i nieznanych `signalKeys`;
- skrócenie długiego podsumowania bez utraty pełnej treści dla czytnika lub
  widoku `/review`.

### Komponentowe

- brak analizy, brak aktywnych Celów, ładowanie, sukces, stale i błąd;
- zgoda przed pierwszym żądaniem;
- brak ponownego żądania po samym wejściu na Start;
- odświeżenie z zachowaniem poprzedniego wyniku;
- poprawne linki i brak martwego CTA;
- feedback sukces/błąd;
- edycja, anulowanie, sukces i błąd szkicu Działania;
- zwijane sygnały i pełna lista spraw wymagających uwagi.

### Regresyjne i integracyjne

- kolejność sekcji: `Najważniejsze teraz` → `Na dziś` → `Kierunek od AI`;
- `/review` nadal generuje i wyświetla pełną analizę;
- tryb demo oraz Supabase realizują ten sam przepływ;
- wynik z cache, limit dzienny, cooldown odświeżenia i błąd dostawcy;
- zmiana Celu/Działania oznacza widoczny wynik jako nieaktualny;
- utworzenie szkicu nie omija istniejącego kontraktu zapisu.

### Kontrole repozytorium

Po każdym etapie uruchomić:

```bash
pnpm lint
pnpm typecheck
pnpm test
VITE_DATA_BACKEND=demo pnpm build
```

## Poza zakresem MVP

- nowy model lub osobny endpoint `ai-start-summary`;
- automatyczne i cykliczne generowanie analizy;
- rozszerzenie kontekstu o pełną Skrzynkę i całą Wiedzę;
- wykonywanie Działań przez AI bez zatwierdzenia;
- personalizacja liczby rekomendacji;
- nowe migracje, telemetria produktowa lub zmiana retencji danych.

Rozszerzenie kontekstu należy zaplanować dopiero po sprawdzeniu, czy użytkownik
potrzebuje na Start informacji spoza portfela Celów. Do tego czasu nazwa i opis
karty muszą jasno komunikować ograniczony zakres.

## Definition of Done

- `Dalszy plan` nie jest już główną sekcją Startu; jego fakty są dostępne pod
  `Sygnały i dalszy plan`.
- Karta AI pokazuje najwyżej jedną główną rekomendację i jeden następny krok.
- Pierwsze wywołanie modelu wymaga świadomej zgody.
- AI nie zapisuje zmian bez osobnego zatwierdzenia.
- Stary wynik pozostaje użyteczny przy odświeżaniu i błędzie.
- Awaria lub brak konfiguracji AI nie pogarsza podstawowej pracy na Start.
- Widok działa na desktopie, 320 px i 390 px oraz z klawiaturą.
- Testy obu backendów i pełne kontrole repozytorium przechodzą.
- Finalny odbiór języka i hierarchii zostaje wykonany na prawdziwych danych.

## Kolejność PR-ów

1. `ai-start-guidance-domain-and-card` — selektor, karta read-only, sygnały.
2. `ai-start-guidance-generation-states` — zgoda, generowanie, stany i błędy.
3. `ai-start-guidance-actions-feedback` — szkic Działania i feedback.
4. `ai-start-guidance-mobile-acceptance` — poprawki odbiorowe i dokumentacja.

Każdy PR powinien być możliwy do wdrożenia lub wycofania niezależnie, bez
zdalnego wdrażania Edge Function i bez zmian schematu bazy.
