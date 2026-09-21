# Plan wdrożenia: spójne i czytelne Działania

Status: gotowy do realizacji, implementacja nierozpoczęta.  
Data: 20 września 2026.  
Podstawa: [audyt doświadczenia Działań](../design/actions-experience-audit-2026-09-20.md).

## 1. Efekt docelowy

Użytkownik ma rozumieć stan, termin, kontekst i pochodzenie Działania bez
zgadywania znaczenia ikony ani otwierania kolejnych okien. Szczegół Działania
ma pozwalać poprawić jego podstawowe dane, a blokada ma być widoczna od razu.
Te same informacje mają być nazywane i formatowane jednakowo na liście
Działań, Starcie, w Projekcie, Celu i Quick Add.

Plan zamyka dziewięć problemów z audytu:

| ID | Priorytet | Rezultat |
| --- | --- | --- |
| ACT-01 | P1 | Edycja podstawowych danych ze szczegółu Działania |
| ACT-02 | P1 | Widoczny powód blokady i szybka możliwość jego poprawienia |
| ACT-03 | P1 | Jednoznaczny licznik „Pozostałe Działania” na Celu |
| ACT-04 | P2 | Tekstowy status na Starcie, w Projekcie i Celu |
| ACT-05 | P2 | Termin i blokada widoczne na liście Działań Projektu |
| ACT-06 | P2 | Jednoznaczny wybór terminu w Quick Add |
| ACT-07 | P2 | Nazwa Rutyny przy wystąpieniu cyklicznym |
| ACT-08 | P3 | Mniej hałaśliwych pustych sekcji w szczególe Działania |
| ACT-09 | P3 | Jeden sposób formatowania dat Działań |

## 2. Granice i decyzje obowiązujące przy wdrożeniu

### W zakresie

- widoki `/actions`, `/actions/:actionId`, Start oraz listy Działań w Projekcie
  i Celu;
- istniejące dialogi statusu, edycji i Quick Add;
- wspólne komponenty statusu, metadanych, pochodzenia i daty;
- testy zachowania, dostępności i regresji na mobile oraz desktopie.

### Poza zakresem

- zmiana stanów workflow Działania albo dodawanie nowych statusów;
- przebudowa modelu Projektów, Celów lub Rutyn;
- nowa paginacja, sortowanie i filtry głównej listy `/actions`;
- automatyczne wybieranie następnego Działania Celu;
- redesign całej aplikacji albo nowy system wizualny.

### Decyzje techniczne

1. **Bez migracji danych.** Wszystkie potrzebne pola już istnieją:
   `title`, `detail`, `scheduledFor`, `pinnedToToday`, `goalId`, `areaId`,
   `status`, `blocker`, `recurringTemplateId` i `checklist`.
2. **Jedna edycja Działania.** Należy wydzielić obecny formularz edycji z
   `GoalDetailPage.tsx` do współdzielonego `ActionEditDialog.tsx`, a następnie
   użyć go na Celu i szczególe Działania. Nie tworzyć drugiego formularza.
3. **Jedna warstwa prezentacji.** Format dat, tekst statusu, sygnał blokady i
   nazwa Rutyny mają powstawać we wspólnych helperach/komponentach, nie osobno
   w każdej stronie.
4. **Status nie może polegać tylko na ikonie lub kolorze.** W listach stosować
   zwarty wariant zawierający ikonę i widoczną etykietę. `aria-label` pozostaje
   pełnym opisem operacji.
5. **„Następne” nie jest częścią licznika pozostałych.** Sekcja Celu otrzymuje
   nazwę „Pozostałe Działania” i liczy tylko otwarte elementy poza wyróżnionym
   następnym krokiem.
6. **Termin i przypięcie są niezależne.** Quick Add nie może sugerować, że
   „Dzisiaj” automatycznie znaczy „Pokaż na Starcie”. Oba pola nadal zapisują
   się niezależnie.
7. **Nazwa Rutyny jest rozwiązywana z bieżącego stanu.** Gdy szablon istnieje,
   pokazujemy `Rutyna: {title}`. Dla niezaładowanego lub niedostępnego szablonu
   bezpieczny fallback to „Z Rutyny”. Nie wykonujemy osobnego zapytania dla
   każdego wiersza.

## 3. Docelowe kontrakty interfejsu

### 3.1. Wspólny wiersz sygnałów Działania

Wprowadzić mały, składany komponent, np. `ActionSignals`, który przyjmuje:

- `action`;
- `timeZone` i opcjonalne `today`;
- `routineTitle`;
- wariant gęstości: `compact`, `list`, `detail`;
- opcjonalną obsługę otwarcia dialogu statusu.

Komponent nie pobiera danych i nie wykonuje mutacji. Odpowiada tylko za
prezentację następujących sygnałów, w tej kolejności:

1. status z tekstem;
2. termin: „Dzisiaj”, „Jutro”, „Zaległe · 18 wrz” albo zwykła data;
3. blokada: widoczny skrócony powód, gdy status to `blocked`;
4. pochodzenie: „Rutyna: Poranny przegląd” albo fallback „Z Rutyny”.

Na bardzo wąskim wierszu sygnały mogą się zawijać, ale tekst statusu i powód
blokady nie mogą zniknąć. Długi powód można wizualnie ograniczyć do dwóch linii;
pełna wartość pozostaje dostępna w szczególe i dla technologii asystujących.

### 3.2. Formatowanie dat

Wydzielić do modułu domenowego, np. `domain/actionPresentation.ts`:

- `formatActionDate(date, timeZone, options)` — polska data kalendarzowa;
- `describeActionSchedule(action, today, timeZone)` — etykieta względna;
- `resolveRoutineTitle(action, recurringTemplates)` — nazwa albo fallback.

Datę `YYYY-MM-DD` interpretować jako datę kalendarzową, bez przesunięcia dnia
przez lokalną strefę procesu testowego. Helper przyjmuje jawną strefę Workspace'u
i jest testowany na co najmniej `Europe/Warsaw` oraz `America/Los_Angeles`.

Uzgodniony format:

- listy zwarte: `18 wrz`, z rokiem tylko poza bieżącym rokiem;
- szczegół: `18 września 2026`;
- wejście formularza: natywne `input[type=date]`;
- wartości surowej `2026-09-18` nie pokazujemy użytkownikowi jako metadanej.

### 3.3. Edycja

`ActionEditDialog` obsługuje nazwę, opis, termin i checklistę — dokładnie zakres
dzisiejszej edycji z Celu. Otrzymuje `action`, `open`, `busy`, błąd i callback
zapisu. Wewnętrzny szkic zachowuje istniejący klucz per Działanie.

Na szczególe Działania przycisk „Edytuj” znajduje się obok operacji statusu,
nie w ukrytym menu. Zapis korzysta z `updateAction` i `expectedVersion`, jeśli
bieżący przepływ już go przekazuje. Podczas zapisu nie można zamknąć dialogu ani
wysłać drugiej operacji. Błąd pozostawia dane i umożliwia ponowienie.

Edycja powodu blokady pozostaje częścią `ActionStatusDialog`, ale na szczególe
widoczny blok ma akcję „Edytuj blokadę”, która otwiera dialog od razu w trybie
edycji blokady. Wymaga to jawnego parametru początkowego, np.
`initialView="blocker"`; nie symulować kliknięcia w DOM.

## 4. Kolejność realizacji

### Etap 0 — stan bazowy i testy charakteryzujące

Cel: zablokować przypadkowe regresje przed wydzielaniem wspólnych elementów.

1. Sprawdzić aktualny `git status` i zachować istniejące zmiany listy Działań.
2. Uruchomić celowane testy bieżących widoków i zapisać zastane błędy osobno.
3. Dodać testy charakteryzujące aktualny zapis edycji z Celu, zmianę statusu z
   powodem blokady oraz niezależność `scheduledFor` i `pinnedToToday`.
4. Przygotować fixture obejmujący:
   - zwykłe Działanie bez daty i opisu;
   - Działanie na dziś, jutrzejsze i zaległe;
   - zablokowane Działanie z długim powodem;
   - wystąpienie istniejącej i brakującej Rutyny;
   - następne Działanie Celu oraz dwa pozostałe kroki.

Pliki testowe: `GoalExperience.test.tsx`, `QuickAdd.test.tsx`,
`ActionsPage.test.tsx` oraz nowy celowany test szczegółu, jeśli obecny plik nie
zapewnia izolowanego pokrycia.

Warunek zakończenia: znamy bazową liczbę przechodzących testów; fixture nie
zależy od bieżącej daty systemowej ani strefy komputera.

### Etap 1 — wspólna prezentacja daty, statusu i Rutyny

Realizuje fundament ACT-04, ACT-07 i ACT-09.

1. Dodać `domain/actionPresentation.ts` i testy jednostkowe formatowania.
2. Rozszerzyć `ActionOriginMarker` o `routineTitle` lub zastąpić go małym
   komponentem pochodzenia; zachować dotychczasowy fallback.
3. Rozszerzyć `ActionStatusTrigger` o jawny wariant gęstości. Wariant zwarty ma
   nadal wyświetlać tekst. Usunąć użycie `ActionStatusIconTrigger` z nowych
   miejsc dopiero po przepięciu wszystkich trzech powierzchni.
4. Złożyć `ActionSignals` bez logiki mutacji. Strony same otwierają istniejący
   `ActionStatusDialog`.
5. Przepiąć główną listę `/actions` jako referencyjną implementację i sprawdzić,
   że istniejące grupowanie oraz filtry nie zmieniły działania.

Pliki:

- nowy `apps/web/src/domain/actionPresentation.ts` i test;
- `apps/web/src/components/ActionStatusControls.tsx` oraz CSS;
- opcjonalnie nowy `apps/web/src/components/ActionSignals.tsx`;
- `apps/web/src/pages/ActionsPage.tsx`.

Kryteria odbioru:

- ta sama data ma ten sam tekst niezależnie od widoku;
- status jest widoczny tekstowo i ma poprawną nazwę dostępną;
- wystąpienie pokazuje nazwę Rutyny, jeśli jest dostępna;
- brak szablonu nie powoduje błędu ani dodatkowego fetchu per wiersz.

### Etap 2 — szczegół Działania: edycja i blokada

Realizuje ACT-01, ACT-02 oraz część ACT-08.

1. Wydzielić formularz edycji z `GoalDetailPage.tsx` do
   `components/ActionEditDialog.tsx`, zachowując szkic, checklistę, walidację,
   retry i blokadę zamknięcia podczas zapisu.
2. Zastąpić lokalny modal Celu współdzielonym komponentem bez zmiany danych
   wysyłanych do `updateAction`.
3. Dodać „Edytuj” na `ActionDetailPage.tsx` i podłączyć ten sam dialog.
4. Przy statusie `blocked` wyrenderować na szczególe osobną, semantyczną sekcję
   „Blokada” z pełnym powodem i akcją „Edytuj blokadę”.
5. Rozszerzyć `ActionStatusDialog` o bezpośrednie otwarcie edytora blokady.
6. Po zmianie statusu z `blocked` na inny ukryć blokadę w UI zgodnie z bieżącym
   kontraktem domenowym. Nie kasować historycznej wartości poza zasadami
   istniejącej komendy.
7. Opis pusty prezentować jako krótki tekst pomocniczy przy operacji edycji,
   bez ciężkiej pustej sekcji. Puste grupy relacji nadal muszą oferować
   potrzebną akcję, ale nie dominować strony.

Kryteria odbioru:

- użytkownik zmienia nazwę, opis, datę i checklistę ze szczegółu;
- zapis aktualizuje szczegół i listy bez przeładowania;
- błąd nie zamyka dialogu i nie traci szkicu;
- powód blokady jest widoczny bez otwierania modala;
- „Edytuj blokadę” otwiera właściwe pole w jednym kroku;
- fokus wraca do przycisku, który otworzył dialog.

### Etap 3 — Cel, Start i Projekt

Realizuje ACT-03, ACT-04 i ACT-05.

#### Cel

1. Zmienić tytuł sekcji na „Pozostałe Działania”.
2. Licznik opierać na dokładnie tej samej kolekcji, która jest renderowana:
   otwarte Działania poza `nextAction`.
3. Pusty stan: „Brak pozostałych otwartych Działań.”
4. W wyróżnionym i zwykłym wierszu użyć wspólnych sygnałów statusu, daty,
   blokady i Rutyny.

#### Start

1. Zastąpić ikonę statusu zwartym przyciskiem z tekstem.
2. Zachować bieżące powiązanie, znacznik „Następne”, obsługę statusu i powrót
   fokusu.
3. Na szerokości 320–390 px przenieść status pod tytuł, jeżeli układ nie mieści
   minimalnych celów dotykowych 44 × 44 px.

#### Projekt

1. W wierszu pokazać status tekstowo.
2. Dodać wspólną etykietę terminu, w tym jawne „Zaległe”.
3. Dla `blocked` pokazać skrócony powód blokady w wierszu.
4. Zachować Cel/Projekt, znacznik „Następne”, filtry i kolejność elementów.
5. Nie duplikować informacji: jeśli nazwa Rutyny jest osobnym sygnałem, nie
   doklejać jej ponownie do tekstu kontekstu.

Pliki: `GoalDetailPage.tsx`, `StartPage.tsx`, `ProjectDetailPage.tsx`, wspólne
komponenty sygnałów i ograniczone reguły w `styles.css`/CSS komponentów.

Kryteria odbioru:

- przy wyróżnionym następnym kroku i dwóch innych Działaniach licznik wynosi 2;
- użytkownik rozpoznaje status bez hovera i bez znajomości ikony;
- zaległość i blokada są widoczne na Projekcie przed otwarciem szczegółu;
- długie tytuły i powody zawijają się, a kontrolki nie nachodzą na treść.

### Etap 4 — jednoznaczny termin w Quick Add

Realizuje ACT-06 i pozostaje zgodny z etapem 1 planu
[„Dodaj” — mobile](./2026-09-11-dodaj-mobile-plan.md). Jeśli tamten plan jest
wdrażany równolegle, wykonać tę pracę tylko raz we wspólnym formularzu.

1. Modelować wybór w UI jako `today | tomorrow | unscheduled | custom`, ale
   nadal zapisywać istniejące `scheduledFor`; nie rozszerzać modelu domenowego.
2. Użyć semantyki pojedynczego wyboru (`radiogroup` + `radio` albo natywne
   radio stylowane jak przyciski), zamiast grupy kilku `aria-pressed`.
3. Dodać czwartą opcję „Inna data”. Pole daty pokazywać lub aktywować tylko dla
   tej opcji.
4. Przy wartości wejściowej innej niż dziś/jutro od razu wybrać „Inna data”.
5. „Bez terminu” czyści tylko `scheduledFor`. Nie zmienia
   `pinnedToToday`; przełącznik Startu pozostaje oddzielny i opisany.
6. Podsumowanie zapisu korzysta ze wspólnego formattera, nie pokazuje surowego
   ISO.

Kryteria odbioru:

- zawsze zaznaczona jest dokładnie jedna opcja terminu;
- custom date przeżywa zapis/odtworzenie szkicu;
- zmiana terminu nie zmienia przypięcia i odwrotnie;
- obsługa klawiaturą i czytnikiem ekranu komunikuje pojedynczy wybór;
- zapisane dane są identyczne z podsumowaniem.

### Etap 5 — redukcja pustych sekcji i migracja pozostałych użyć

Domyka ACT-08 i ACT-09.

1. Przejrzeć wszystkie użycia `ActionStatusIconTrigger`, surowego
   `scheduledFor` i lokalnego `toLocaleDateString` dla Działań.
2. Przepiąć tylko powierzchnie Działań objęte tym planem. Nie rozszerzać pracy
   przypadkiem na daty Skrzynki, Wiedzy lub historii aktywności.
3. Na szczególe ukrywać pustą treść sekcji, jeżeli nie zawiera informacji ani
   operacji. Jeżeli operacja jest ważna, pokazać lekki wiersz CTA zamiast dużej
   pustej karty.
4. Usunąć martwe warianty CSS i `ActionStatusIconTrigger` dopiero, gdy `rg`
   potwierdzi brak użyć. Nie wykonywać masowego formatowania `styles.css`.
5. Sprawdzić, że tooltipy są dodatkiem, a nie jedynym nośnikiem informacji.

## 5. Strategia testów

### Jednostkowe

- format krótkiej i pełnej daty w dwóch strefach;
- „Dzisiaj”, „Jutro”, „Zaległe” i „Bez terminu”;
- nazwa istniejącej Rutyny oraz fallback dla brakującej;
- licznik pozostałych Działań bez następnego i zamkniętych;
- mapowanie stanu wyboru Quick Add na `scheduledFor`.

### Integracyjne React

- szczegół: otwarcie edycji, sukces, błąd/retry, zachowanie szkicu i fokus;
- blokada: widoczny powód, bezpośrednia edycja, zmiana statusu i undo;
- Cel: „Następne Działanie” + „Pozostałe Działania 2”, brak sprzecznego zera;
- Start/Projekt/Cel: widoczna etykieta statusu i dostępny dialog;
- Projekt: zaległa data i powód blokady;
- Rutyna: nazwa szablonu i fallback;
- Quick Add: radio, custom date, niezależne przypięcie i dane komendy.

Aktualizować istniejące asercje świadomie. Test oczekujący braku tekstu
„Do zrobienia” przestaje opisywać wymagany interfejs po ACT-04 i powinien zostać
zmieniony na sprawdzenie właściwej etykiety oraz dostępnej operacji.

### Wizualne i manualne

Sprawdzić szerokości 320, 390, 768 i 1440 px oraz zoom 200%:

- zwykłe, zaległe i zablokowane Działanie;
- bardzo długi tytuł i powód blokady;
- Cel z następnym krokiem i bez niego;
- Projekt z mieszanką statusów;
- Quick Add z natywnym selektorem daty;
- szczegół z pustym opisem i bez relacji Wiedzy.

Kontrola dostępności:

- jeden logiczny `h1`, poprawne nagłówki sekcji;
- widoczny fokus i poprawny powrót po zamknięciu modala;
- cele dotykowe minimum 44 × 44 px;
- status i blokada zrozumiałe bez koloru;
- brak poziomego przewijania i zasłonięcia przez dolną nawigację;
- kolejność Tab zgodna z kolejnością wizualną.

### Kontrole automatyczne

Po każdym etapie uruchamiać celowane testy zmienionego obszaru. Przed odbiorem:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Zastany błąd należy odnotować przed pracą. Odbiór wymaga braku nowych regresji;
test celowo zmieniany przez ACT-04 aktualizujemy razem z implementacją, a nie
oznaczamy jako błąd bazowy.

## 6. Ryzyka i zabezpieczenia

| Ryzyko | Zabezpieczenie |
| --- | --- |
| Rozjazd formatowania przez strefę czasu | Jeden helper i testy w dwóch strefach |
| Zbyt gęste wiersze na mobile | Wariant `compact`, zawijanie sygnałów, test od 320 px |
| Drugi, niespójny formularz edycji | Wydzielenie obecnej edycji Celu przed dodaniem jej do szczegółu |
| N+1 dla nazw Rutyn | Mapa `id → title` budowana z `state.recurringTemplates` przez `useMemo` |
| Utrata szkicu przy przenoszeniu modala | Zachowanie klucza `goal-action-edit` per `action.id` i test zamknij/otwórz |
| Sprzeczne dane Cel/Projekt | Edycja nie rozszerza zakresu relacji; używa bieżącego kontraktu `updateAction` |
| Powielona praca z planem Quick Add | ACT-06 realizowany w tym samym wspólnym formularzu co plan „Dodaj” |
| Globalne regresje CSS | Klasy komponentów/stron, bez szerokich selektorów i kolejnych globalnych override'ów |

## 7. Proponowany podział zmian

Zmiany można dostarczyć w czterech niezależnie weryfikowalnych paczkach:

1. **Prezentacja:** helper dat, `ActionSignals`, nazwa Rutyny, testy jednostkowe.
2. **Szczegół:** wspólny `ActionEditDialog`, widoczna blokada, redukcja pustych
   sekcji.
3. **Listy kontekstowe:** Cel, Start, Projekt i aktualizacja testów statusu.
4. **Quick Add i odbiór:** jednoznaczny termin, migracja pozostałych użyć,
   responsive i pełne kontrole.

Każda paczka musi kompilować się i przechodzić swoje testy. Nie zostawiać
przejściowo dwóch źródeł formatowania dat lub dwóch formularzy edycji dłużej niż
na czas jednej paczki.

## 8. Definition of Done

Plan jest wykonany, gdy:

- szczegół Działania pozwala edytować podstawowe dane bez przechodzenia do Celu;
- powód blokady jest widoczny i edytowalny jednym kliknięciem;
- Cel rozróżnia następne i pozostałe Działania, a licznik zgadza się z listą;
- Start, Projekt i Cel pokazują status tekstem, nie samą ikoną;
- Projekt pokazuje termin/zaległość oraz powód blokady;
- Quick Add ma jednoznaczny, dostępny wybór terminu i niezależne przypięcie;
- wystąpienie cykliczne pokazuje nazwę Rutyny, jeśli jest dostępna;
- puste sekcje nie dominują szczegółu;
- daty Działań są formatowane wspólnie i zgodnie ze strefą Workspace'u;
- wszystkie zmiany działają w trybie demo i Supabase bez migracji schematu;
- testy celowane, lint, typecheck, pełne testy i build są rozliczone;
- końcowy raport zawiera zmienione pliki, wyniki kontroli oraz zrzuty mobile i
  desktop dla szczegółu, Celu, Projektu, Startu i Quick Add.

## 9. Polecenie do realizacji

```text
Zaimplementuj plan /Users/jakub/Documents/project-learning-app/docs/planning/2026-09-20-actions-experience-remediation.md. Zachowaj istniejące zmiany użytkownika i bieżące kontrakty danych. Realizuj etapy po kolei, po każdym uruchom celowane testy, a na końcu lint, typecheck, pełne testy i build. Nie twórz migracji bazy. Zapisz raport wdrożenia i zrzuty mobile/desktop zgodnie z Definition of Done.
```
