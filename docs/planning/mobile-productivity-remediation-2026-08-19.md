# Plan poprawek mobilnych i produktywności

Data audytu: 19 sierpnia 2026  
Status: wykonany — dokument historyczny
Widoki referencyjne: `390 × 844` oraz granicznie `320 × 700`

Zakres audytu i wynikające z niego poprawki zostały wdrożone w kolejnych
planach produktowych. Dokument pozostaje punktem odniesienia dla decyzji z
19 sierpnia 2026, ale nie jest już kolejką aktywnych prac.

## Cel

Mobilna wersja ma pozwalać przejść z przechwycenia pomysłu do wykonania
konkretnego Działania bez szukania funkcji, zbędnego przewijania i utraty
kontekstu. Każda główna sekcja powinna być osiągalna w maksymalnie dwóch
tapnięciach z dowolnego ekranu.

Plan zakłada Tailwind CSS 4 jako podstawowy sposób układania responsywności i
wariantów oraz komponenty shadcn/ui jako wspólne prymitywy interakcji. Nowe
rozwiązania nie powinny powiększać monolitycznego `styles.css` o kolejne
nakładające się reguły dla `max-width: 767px`.

## Zakres audytu

W działającej, zalogowanej aplikacji w Chrome sprawdzono:

- Dzisiaj oraz formularze zwykłego i cyklicznego Działania;
- Projekty, szczegóły Projektu, zakładki, edycję i formularze dodawania;
- Rutyny i edycję serii;
- Cele, filtry, nowy Cel, szczegóły Celu i edycję Działania;
- Wiedzę, wszystkie widoki widoczności i formularz tworzenia;
- Inbox, typy capture i wszystkie zakładki;
- Podsumowanie tygodnia;
- globalne wyszukiwanie z wynikami;
- centrum szybkiego dodawania dla Działania, Celu, Wiedzy i Inboxu;
- mobilne centrum „Więcej”.

Nie wykonano finalnych zapisów, zmian statusu, archiwizacji, przenoszenia do
Kosza, wylogowania ani eksportu. Szczegółu Wiedzy nie dało się sprawdzić na
realnym rekordzie, ponieważ bieżący Workspace nie zawierał elementów Wiedzy.
Widok historycznej sesji Focus nie miał dostępnego rekordu testowego.

## Najważniejsze ustalenia

### P0 — blokery przepływu

1. **Niepełna nawigacja mobilna.** Dolny pasek udostępnia Dzisiaj, Projekty,
   Dodaj i Wiedzę. „Więcej” pokazuje profil, statystyki, eksport i wylogowanie,
   ale nie zawiera Celów, Rutyn ani Inboxu. Te sekcje nie są osiągalne z
   mobilnej nawigacji. Na ich trasach żaden element dolnego paska nie pokazuje
   także aktywnego kontekstu.
2. **Uszkodzony link do Działania w Projekcie.** Link generowany w szczególe
   Projektu prowadzi zawsze do `/actions/:id`. Działanie należące do Celu
   kończy na stanie „Działanie jest niedostępne”, mimo że rekord istnieje.
3. **Brak resetu przewinięcia po zmianie trasy.** Wejście z niżej położonej
   karty Projektu lub Celu otwiera szczegół na odziedziczonej pozycji scrolla.
   W audycie szczegół Projektu otworzył się na `scrollY=309`, a szczegół Celu
   na `scrollY=282`, z uciętym nagłówkiem.

### P1 — największy wpływ na produktywność

4. **Dzisiaj powiela te same CTA.** Przy pustym widoku „Dodaj Działanie” i
   „Nowe cykliczne” występują w nagłówku oraz ponownie w empty state. Na małym
   ekranie cztery przyciski konkurują o uwagę.
5. **Tworzenie Celu i Rutyny jest zbyt długie.** Formularze mają dobrą,
   przyklejoną stopkę, ale duża liczba kart, opisów, presetów i podsumowań
   wymusza długie przewijanie. W Rutynie preset „Przegląd celów” występuje
   jednocześnie jako gotowa propozycja i własne ustawienie.
6. **Filtry Celów zajmują prawie cały ekran.** Siedem statusów ustawiono w
   jednej pionowej kolumnie. Zmiana jednego filtra wymaga otwarcia dużego
   arkusza i przewijania zamiast szybkiego wyboru.
7. **Listy Celów są mało skanowalne.** Długie tytuły i rezultaty zajmują cały
   pierwszy ekran, a główne CTA znajduje się przy dole karty. Karta powinna być
   jedną dużą powierzchnią klikalną, z ograniczoną liczbą linii w widoku listy.
8. **Walidacja nowego Celu jest niespójna wizualnie.** „Utwórz cel” wygląda na
   aktywne przy pustej wymaganej nazwie; walidacja zatrzymuje submit dopiero po
   kliknięciu. Inne formularze poprawnie wyłączają przycisk przed podaniem
   wymaganych danych.

### P2 — spójność, czytelność i utrzymanie

9. **„Więcej” miesza nawigację z kontem.** Profil, stan synchronizacji,
   statystyki i operacje na danych nie tworzą skrótu do pracy. Potrzebne są
   osobne grupy „Workspace” i „Konto i dane”.
10. **Typografia pomocnicza jest miejscami zbyt drobna.** Wspólne style używają
    tekstu `9–11px` m.in. w statystykach i metadanych. Na telefonie tekst
    informacyjny powinien mieć co najmniej `12px`, a podstawowy `14–16px`.
11. **Warstwa mobilnego CSS jest trudna do rozwijania.** W `styles.css` istnieje
    kilka osobnych bloków `@media (max-width: 767px)` i wiele selektorów
    opartych na strukturze DOM lub `:has()`. Zwiększa to ryzyko regresji przy
    kolejnych zmianach komponentów.

## Docelowa architektura mobilna

### Nawigacja

Rekomendowany dolny pasek:

1. Dzisiaj
2. Projekty
3. Dodaj — centralne CTA
4. Inbox
5. Więcej

„Więcej” powinno otwierać shadcn `Sheet` z dwiema sekcjami:

- **Workspace:** Cele, Rutyny, Wiedza, Podsumowanie;
- **Konto i dane:** profil, synchronizacja, eksport, wylogowanie.

Inbox jest ważniejszy w dolnym pasku niż Wiedza, ponieważ wspiera codzienne
przechwytywanie i opróżnianie kolejki. Wiedza pozostaje o jedno tapnięcie dalej.
Aktywny stan „Więcej” ma obejmować wszystkie trasy należące do tego arkusza.

### Komponenty shadcn/ui

- `Sheet` — mobilne „Więcej” i lekkie akcje kontekstowe;
- `Command` — wyszukiwanie globalne i opcjonalnie wybór powiązań;
- `Dialog` lub `Drawer` — formularze tworzenia; jeden wspólny wariant
  responsywny zamiast osobnych wyjątków CSS;
- `DropdownMenu` — menu encji na desktopie;
- `Tabs` — widoki list, ze zwartym wariantem mobilnym;
- `Collapsible` lub `Accordion` — pola opcjonalne i ustawienia zaawansowane;
- `AlertDialog` — operacje nieodwracalne; operacje odwracalne zachowują Undo;
- istniejące `Button`, `Input`, `Textarea`, `Select`, `Badge`, `Card`,
  `Progress` i `Skeleton` pozostają wspólnymi prymitywami.

Warianty powinny być definiowane przez CVA, a układ responsywny bezpośrednio w
klasach Tailwind (`grid`, `gap-*`, `sm:*`, `md:*`, `line-clamp-*`,
`pb-[calc(...+env(safe-area-inset-bottom))]`). `styles.css` powinien pozostać
głównie miejscem na tokeny motywu, bazową typografię, safe-area i nieliczne
animacje.

## Backlog realizacyjny

### MOB-01 — Pełna nawigacja mobilna

**Priorytet:** P0  
**Rozmiar:** M  
**Pliki startowe:** `AppShell.tsx`, `styles.css`, `App.regression.test.tsx`

- Zmienić dolny pasek na Dzisiaj / Projekty / Dodaj / Inbox / Więcej.
- Przebudować „Więcej” na shadcn `Sheet` z pełną mapą sekcji.
- Pokazywać badge Inboxu zarówno na bezpośrednim skrócie, jak i w Sheet.
- Dodać aktywny stan dla `/goals`, `/routines`, `/knowledge`, `/review` oraz
  ich tras szczegółowych.
- Zachować minimum `44 × 44px`, safe-area i obsługę klawiatury.

**Akceptacja:** każda główna sekcja jest osiągalna w maksymalnie dwóch
tapnięciach z dowolnej trasy; test regresyjny sprawdza komplet nawigacji mobile,
nie tylko desktopowy sidebar.

### MOB-02 — Poprawne przejścia między encjami i scroll

**Priorytet:** P0  
**Rozmiar:** S

- W `ProjectDetailPage` generować trasę Działania przez `routeForEntity`, z
  `goalId` dla Działań należących do Celu.
- Ujednolicić wszystkie linki encji w listach, wyszukiwarce i relacjach.
- Dodać globalny `ScrollToTop` oparty o `location.pathname`.
- Przy nawigacji wstecz zachować natywne odtworzenie pozycji; przy wejściu w
  nowy szczegół zaczynać od góry.
- Obsłużyć `?action=:id`: przewinąć do Działania i nadać mu fokus.

**Akceptacja:** link Projekt → Działanie otwiera właściwy Cel i wyróżnione
Działanie; żadna nowa trasa szczegółu nie startuje w połowie strony.

### MOB-03 — Jedna dominująca akcja na ekranie Dzisiaj

**Priorytet:** P1  
**Rozmiar:** S

- W pustym widoku usunąć duplikat pary CTA z nagłówka albo z empty state.
- Zostawić „Dodaj Działanie” jako główne CTA i „Nowe cykliczne” jako link lub
  przycisk drugorzędny.
- Przy niepustej liście zachować kompaktowe szybkie dodawanie nad zadaniami.
- Ujednolicić nazwy „Działanie”/„Zadanie” zgodnie z decyzją domenową.

**Akceptacja:** na pierwszym ekranie widoczna jest jedna oczywista akcja
główna; nie ma czterech przycisków prowadzących do dwóch tych samych operacji.

### MOB-04 — Krótsze tworzenie Celu i Rutyny

**Priorytet:** P1  
**Rozmiar:** L

- Cel: pierwszy ekran tylko nazwa, opcjonalny rezultat i Projekt; szablon,
  pierwsze Działanie i kryteria w `Collapsible` „Więcej opcji”.
- Rutyna: domyślnie nazwa + częstotliwość + start; checklistę, catch-up, koniec
  i powiązania przenieść do „Więcej opcji”.
- Presety pokazać jako poziomą listę chipów i usunąć duplikat sekcji własnych
  ustawień.
- Utrzymać sticky footer nad klawiaturą i bottom nav.
- Wyłączyć submit, dopóki wymagane pola są puste; błędy pokazywać przy polu.

**Akceptacja:** prosty Cel i cotygodniowa Rutyna są możliwe do utworzenia bez
przewijania przy `390 × 844`; zaawansowane opcje pozostają dostępne.

### MOB-05 — Skanowalne listy i większe powierzchnie tapnięcia

**Priorytet:** P1  
**Rozmiar:** M

- Całą kartę Celu, Projektu, Wiedzy i wiersz encji uczynić jednym linkiem
  głównym, bez zagnieżdżania przycisków w linku.
- Na listach ograniczyć tytuł do 2–3 linii, a opis do 2 linii; pełną treść
  pozostawić w szczególe.
- Najważniejszy sygnał pokazywać wysoko: blokada, zaległość albo następny krok.
- Menu drugorzędne przenieść do osobnego `DropdownMenu`/`Sheet`.

**Akceptacja:** pierwszy Cel można otworzyć jednym tapnięciem w dowolnym miejscu
karty, a na `390px` widać nagłówek i istotny kontekst bez przewinięcia całej
karty.

### MOB-06 — Zwarte filtry, zakładki i stany list

**Priorytet:** P1  
**Rozmiar:** M

- Filtry Celów ułożyć jako siatkę 2 kolumn lub poziome chipsy z przewijaniem.
- Najczęstsze stany: Aktywne, Wszystkie; pozostałe w sekcji rozwijanej.
- Naprawić polską odmianę liczników (`1 Cel`, `2 Cele`, `5 Celów`).
- Zapisywać filtry w URL, ale zamykać arkusz po wyborze bez dodatkowego CTA,
  jeśli wynik aktualizuje się natychmiast.
- Zachować siatkę 2 × 2 Inboxu, która w audycie działała poprawnie.

**Akceptacja:** zmiana statusu Celu wymaga maksymalnie dwóch tapnięć i nie
wymaga przewijania arkusza na `320 × 700`.

### MOB-07 — Czytelność szczegółów i priorytety treści

**Priorytet:** P2  
**Rozmiar:** M

- W szczególe Celu ograniczyć metryki do trzech najważniejszych na pierwszym
  ekranie; resztę przenieść niżej.
- Długie tytuły zachować w całości, ale zmniejszać płynnie przez Tailwind
  `clamp()` i ograniczyć dekoracyjne odstępy.
- W szczególe Projektu utrzymać sticky, przewijalne zakładki i czytelne
  tekstowe etykiety akcji; nie polegać wyłącznie na ikonach `+`.
- Podnieść tekst pomocniczy do minimum `12px`, treść do `14–16px`.

**Akceptacja:** na `320px` nie ma poziomego overflow, uciętych selektów ani
tekstów interaktywnych poniżej `12px`.

### MOB-08 — Uporządkowanie prymitywów Tailwind/shadcn

**Priorytet:** P2  
**Rozmiar:** L

- Dodać brakujące prymitywy shadcn wymienione w architekturze mobilnej.
- Wydzielić warianty `mobileSheet`, `entityCard`, `stickyFormActions` i
  `compactTabs` przez CVA.
- Przenieść układ komponentów z globalnych selektorów strukturalnych do klas
  Tailwind w TSX.
- Scalić bloki `@media (max-width: 767px)` i usunąć martwe/duplikujące reguły.
- Nie zmieniać tokenów kolorystycznych bez osobnej decyzji wizualnej.

**Akceptacja:** nowe ekrany nie wymagają dopisywania globalnych selektorów
zależnych od kolejności dzieci; warianty są testowalne i reużywalne.

### MOB-09 — Regresja responsywna i pomiar produktywności

**Priorytet:** P1, realizować równolegle z ticketami 01–08  
**Rozmiar:** M

- Dodać testy tras i mobilnej nawigacji w React Testing Library.
- Dodać automatyczny smoke test głównych przepływów dla `390 × 844` i
  `320 × 700`.
- Sprawdzać brak poziomego overflow i zasłaniania akcji przez bottom nav.
- Testować focus trap, Escape, powrót fokusu, etykiety oraz `prefers-reduced-motion`.
- Po wdrożeniu wykonać ponowny audyt Chrome na realnym Workspace.

**Akceptacja:** przechodzą scenariusze Dzisiaj → nowe Działanie, Projekt → Cel
→ Działanie, Inbox → capture, wyszukiwarka → wynik oraz dostęp do wszystkich
sekcji z dolnej nawigacji.

## Kolejność wdrożenia

1. **Sprint 1 — odzyskanie dostępu:** MOB-01, MOB-02 i testy krytycznych tras.
2. **Sprint 2 — szybkość wykonania:** MOB-03, MOB-04, MOB-06.
3. **Sprint 3 — skanowanie i czytelność:** MOB-05, MOB-07.
4. **Sprint 4 — stabilizacja systemu UI:** MOB-08 i pełne MOB-09.

Nie należy zaczynać wizualnego polerowania kart przed zamknięciem MOB-01 i
MOB-02, ponieważ obecnie użytkownik może nie dotrzeć do funkcji albo trafić na
błędny szczegół.

## Definition of Done

- wszystkie główne trasy są osiągalne na mobile w maksymalnie dwóch tapnięciach;
- nowa trasa otwiera się od góry, a back zachowuje sensowny kontekst;
- brak poziomego overflow przy `320px` i `390px`;
- aktywne przyciski dotykowe mają minimum `44 × 44px`;
- dolny pasek i klawiatura nie zasłaniają pól ani akcji końcowych;
- formularze mają spójne disabled, loading, błąd i zachowanie draftu;
- operacje ryzykowne zachowują AlertDialog lub Undo zgodnie z odwracalnością;
- `pnpm lint`, `pnpm typecheck`, `pnpm test` i `pnpm build` przechodzą;
- ponowny audyt Chrome potwierdza scenariusze na `390 × 844` i `320 × 700`.

## Mierniki sukcesu

- capture tekstu lub linku: poniżej 15 sekund;
- utworzenie prostego Działania: poniżej 20 sekund;
- utworzenie prostego Celu: poniżej 45 sekund;
- utworzenie cotygodniowej Rutyny: poniżej 60 sekund;
- dotarcie do dowolnej głównej sekcji: maksymalnie 2 tapnięcia;
- otwarcie encji z listy: 1 tapnięcie w kartę;
- zero błędnych deep linków i zero wejść w szczegół z odziedziczonym scrollem.
