# Audyt doświadczenia Działań

Data: 20 września 2026  
Zakres: mobilny przepływ Działań na ekranie Start, w Projekcie, w Celu, na szczególe Działania i w formularzu szybkiego dodawania.  
Cel użytkownika: szybko znaleźć właściwy krok, zrozumieć jego stan i kontekst, zmienić go oraz utworzyć kolejny bez szukania właściwego ekranu.

## Materiał dowodowy

Audyt wykonano w działającej aplikacji pod `http://localhost:5173` na danych użytkownika. W bieżącej sesji przeglądarki przechwycono i sprawdzono następujące widoki:

1. `audit01Start` — Start i sekcja „Na dziś”.
2. `audit02ProjectActions` — Projekt `command`, karta „Działania”.
3. `audit03ActionDetail` — szczegół zwykłego Działania.
4. `audit04Goal` — Cel z wyróżnionym „Następnym Działaniem”.
5. `audit05QuickAdd` — formularz „Nowe Działanie” z rozwiniętymi ustawieniami.
6. `audit06RoutineAction` — szczegół Działania utworzonego przez Rutynę.
7. `audit07BlockedAction` — szczegół zablokowanego Działania.

Zrzuty zostały wyświetlone i ocenione w tej samej sesji audytu. Narzędzie przeglądarki nie udostępniło ścieżek plikowych do przechwyconych obrazów, dlatego trwałym rezultatem jest ten raport oraz wymienione identyfikatory dowodów sesji.

## Najważniejsze ustalenie

Model Działania jest spójny w danych, ale nie w interfejsie. Ta sama informacja jest prezentowana inaczej w zależności od miejsca:

- główna lista pokazuje tekst statusu, kontekst i termin;
- Start, Projekt i wyróżnione Działanie Celu wracają do samotnej ikony statusu;
- szczegół Działania nie daje spójnego wejścia do edycji;
- przyczyna blokady istnieje w danych, lecz znika ze szczegółu;
- Działanie z Rutyny pokazuje pochodzenie, ale nie nazwę Rutyny.

Efekt: użytkownik musi pamiętać znaczenie ikon i wiedzieć, z którego ekranu da się wykonać konkretną operację.

## Backlog do poprawy

### ACT-01 — Dodać edycję na szczególe Działania

Priorytet: **P1**  
Dowód: `audit03ActionDetail`, `audit07BlockedAction`  
Miejsce: `apps/web/src/pages/ActionDetailPage.tsx`

**Problem**

Na szczególe można zmienić status, przypiąć krok i go ukończyć, ale nie można edytować nazwy, opisu, terminu ani kontekstu. Edycja istnieje w menu Działania wewnątrz Celu, więc funkcjonalność zależy od drogi wejścia. Działanie bez Celu lub bezpośrednio w Projekcie nie ma równie oczywistej ścieżki edycji.

**Proponowana poprawka**

Dodać przycisk „Edytuj” lub menu `…` w nagłówku szczegółu. Formularz powinien obsługiwać tytuł, opis, termin, przypisanie do Celu/Projektu oraz ustawienie „Pokaż na Starcie”. Warto współdzielić formularz z istniejącym edytorem z `GoalDetailPage.tsx`, zamiast tworzyć trzeci wariant.

**Kryteria akceptacji**

- Na każdym szczególe Działania dostępna jest akcja „Edytuj”.
- Działa dla Działania samodzielnego, projektowego, powiązanego z Celem i utworzonego przez Rutynę.
- Po zapisie zaktualizowane wartości są widoczne bez ręcznego odświeżania.
- Anulowanie nie zmienia danych i przywraca fokus do przycisku otwierającego.
- Test obejmuje zmianę tytułu, opisu, terminu i kontekstu.

### ACT-02 — Pokazać przyczynę blokady na szczególe

Priorytet: **P1**  
Dowód: `audit07BlockedAction`  
Miejsce: `apps/web/src/pages/ActionDetailPage.tsx`, `apps/web/src/components/ActionStatusControls.tsx`

**Problem**

Zablokowane Działanie pokazuje czerwony status, ale nie pokazuje tekstu `action.blocker`. Powód „Muszę zdobyć więcej informacji” jest dostępny dopiero po otwarciu statusu i ponownym wybraniu „Zablokowane”. To najważniejsza informacja potrzebna do odblokowania pracy.

**Proponowana poprawka**

Pod statusem wyświetlić stały panel „Co blokuje” z tekstem przeszkody oraz przyciskiem „Edytuj blokadę”. W oknie zmiany statusu aktualny powód powinien być widoczny bez dodatkowego kliknięcia.

**Kryteria akceptacji**

- Gdy `status === "blocked"`, powód blokady jest widoczny nad opisem Działania.
- Użytkownik może edytować powód jednym kliknięciem.
- Po odblokowaniu panel znika.
- Informacja nie jest przekazywana wyłącznie kolorem.
- Test sprawdza widoczność, edycję i usunięcie panelu po odblokowaniu.

### ACT-03 — Usunąć sprzeczność „Następne Działanie” / „Działania 0”

Priorytet: **P1**  
Dowód: `audit04Goal`  
Miejsce: `apps/web/src/pages/GoalDetailPage.tsx`

**Problem**

Cel pokazuje aktywne „Następne Działanie”, a kilka centymetrów niżej nagłówek „Działania 0”. Kod liczy tylko `remainingActions`, lecz etykieta brzmi jak liczba wszystkich Działań. To wygląda jak niespójność danych.

**Proponowana poprawka**

Zmienić nazwę sekcji na „Pozostałe Działania” i zachować licznik pozostałych albo liczyć wszystkie otwarte Działania. Rekomendowany wariant: „Pozostałe Działania”, ponieważ wyróżniony krok jest już pokazany osobno.

**Kryteria akceptacji**

- Przy jednym wyróżnionym kroku i braku innych sekcja nazywa się „Pozostałe Działania 0”.
- Pusty komunikat brzmi „Brak pozostałych otwartych Działań”.
- Licznik nie zmienia znaczenia po ustawieniu innego kroku jako następnego.
- Test obejmuje 0, 1 i kilka pozostałych Działań.

### ACT-04 — Ujednolicić prezentację statusu na wszystkich listach

Priorytet: **P2**  
Dowód: `audit01Start`, `audit02ProjectActions`, `audit04Goal`  
Miejsce: `apps/web/src/pages/StartPage.tsx`, `apps/web/src/pages/ProjectDetailPage.tsx`, `apps/web/src/pages/GoalDetailPage.tsx`, `apps/web/src/components/ActionStatusControls.tsx`

**Problem**

Główna lista Działań pokazuje „Do zrobienia”, „W toku” itd., ale Start, Projekt i Cel używają wyłącznie ikon. Ikona koła, loadera lub probówki wymaga zapamiętania legendy. Kolor i kształt nie wystarczają do szybkiego rozpoznania stanu.

**Proponowana poprawka**

Wprowadzić jeden kompaktowy wariant kontrolki statusu z ikoną i tekstem. Na bardzo wąskich listach etykieta może znajdować się w wierszu metadanych, ale musi pozostać widoczna. `ActionStatusIconTrigger` powinien pozostać tylko tam, gdzie obok istnieje jawna etykieta statusu.

**Kryteria akceptacji**

- Każda karta Działania pokazuje tekst statusu bez otwierania dialogu.
- Kliknięcie etykiety nadal otwiera ten sam dialog statusu.
- Statusy nie są rozróżniane wyłącznie kolorem.
- Kontrolka zachowuje minimum 44 × 44 px obszaru dotykowego albo równoważny obszar całego wiersza.
- Testy Startu, Projektu i Celu wyszukują widoczny tekst statusu.

### ACT-05 — Dodać sygnały terminu i blokady na liście Projektu

Priorytet: **P2**  
Dowód: `audit02ProjectActions`  
Miejsce: `apps/web/src/pages/ProjectDetailPage.tsx`

**Problem**

Projektowa lista jest gęsta, ale nie pokazuje jawnie terminu dla Działań bez daty i nie pokazuje przyczyny blokady. Kontekst Celu lub napis „Działanie Projektu” konkuruje z długim tytułem, a samotna ikona statusu jest głównym sygnałem stanu.

**Proponowana poprawka**

Zastosować tę samą kolejność metadanych co na głównej liście: status, `Cel: …` lub `Bezpośrednio w Projekcie`, następnie termin. Dla blokady dodać jednowierszowy powód. Tytuł ograniczyć do maksymalnie 2–3 linii.

**Kryteria akceptacji**

- Każdy wiersz pokazuje tekst statusu, kontekst i termin/„Bez terminu”.
- Zaległy termin ma tekst „Zaległe”, a nie tylko kolor.
- Zablokowany krok pokazuje skrócony powód blokady.
- Długi tytuł nie wypycha kontrolki statusu poza ekran.

### ACT-06 — Uporządkować wybór terminu w szybkim dodawaniu

Priorytet: **P2**  
Dowód: `audit05QuickAdd`  
Miejsce: `apps/web/src/components/QuickAdd.tsx`

**Problem**

„Dzisiaj”, „Jutro” i „Bez terminu” są wzajemnie wykluczającymi się opcjami, ale w drzewie dostępności zachowują się jak oddzielne przełączniki. Przy zaznaczonym „Bez terminu” pole „Dokładna data” nadal jest stale widoczne, więc nie wiadomo, która wartość ma pierwszeństwo. Początkowo formularz ma dużo pustej przestrzeni między polami a przyciskiem zapisu.

**Proponowana poprawka**

Użyć semantyki `radiogroup`/`radio` dla szybkiego terminu. Dodać wariant „Inna data” i pokazywać date picker dopiero po jego wyborze. W stanie podstawowym zmniejszyć pionową pustkę albo przesunąć podsumowanie terminu bliżej sekcji ustawień.

**Kryteria akceptacji**

- Czytnik ekranu rozpoznaje jedną grupę z jednym wybranym terminem.
- Wybór „Bez terminu” czyści dokładną datę.
- Wybór dokładnej daty przełącza stan na „Inna data”.
- Podsumowanie nad przyciskiem zapisu zawsze odpowiada zapisanej wartości.
- Nawigacja strzałkami działa w obrębie grupy radiowej.

### ACT-07 — Pokazać nazwę Rutyny przy Działaniu cyklicznym

Priorytet: **P2**  
Dowód: `audit06RoutineAction`  
Miejsce: `apps/web/src/pages/ActionDetailPage.tsx`, `apps/web/src/components/ActionStatusControls.tsx`

**Problem**

Szczegół pokazuje tylko „Wystąpienie Rutyny”. Użytkownik może przejść do serii, ale nie wie, do której Rutyny prowadzi link. Na liście widnieje jeszcze krótsze „Z Rutyny”.

**Proponowana poprawka**

Rozwiązać `recurringTemplateId` do nazwy Rutyny i wyświetlić `Rutyna: {nazwa}`. „Wystąpienie z 20 wrz 2026” może zostać drugą linią. Link powinien zachować przejście do edycji serii.

**Kryteria akceptacji**

- Działanie cykliczne pokazuje nazwę Rutyny.
- Data wystąpienia jest sformatowana tak samo jak terminy na liście.
- Link prowadzi do właściwej serii.
- Brakująca lub usunięta seria ma zrozumiały fallback, np. „Rutyna niedostępna”.

### ACT-08 — Ograniczyć puste sekcje na szczególe

Priorytet: **P3**  
Dowód: `audit03ActionDetail`, `audit06RoutineAction`, `audit07BlockedAction`  
Miejsce: `apps/web/src/pages/ActionDetailPage.tsx`, `apps/web/src/components/ActionKnowledgeRelations.tsx`

**Problem**

„Bez dodatkowego opisu”, „Brak materiałów” i puste „Rezultaty” zajmują większość ekranu, mimo że nie pomagają wykonać kroku. Główne akcje spadają niżej.

**Proponowana poprawka**

Połączyć puste informacje w jeden kompaktowy panel „Brak dodatkowego kontekstu” albo ukrywać pusty opis. W pustej sekcji Wiedzy pokazać jedno zdanie i dwie akcje: „Dodaj materiał” i „Dodaj rezultat”.

**Kryteria akceptacji**

- Pusty szczegół mieści tytuł, status, kontekst i główną akcję wyżej niż obecnie.
- Po dodaniu opisu lub Wiedzy odpowiednia sekcja rozwija się automatycznie.
- Nazwy „Materiały” i „Rezultaty” pozostają dostępne dla istniejących treści.

### ACT-09 — Ujednolicić format terminów

Priorytet: **P3**  
Dowód: `audit02ProjectActions`, `audit06RoutineAction`  
Miejsce: `apps/web/src/pages/ProjectDetailPage.tsx`, `apps/web/src/pages/GoalDetailPage.tsx`, `apps/web/src/pages/ActionDetailPage.tsx`

**Problem**

Ten sam termin występuje jako `2026-09-20`, `20.09.2026`, `20 wrz 2026` albo „Dzisiaj”. Różnice wynikają z renderowania surowej wartości i kilku osobnych formatterów.

**Proponowana poprawka**

Wydzielić jeden formatter domenowy dla terminu Działania. Wariant kontekstowy może zwracać „Dzisiaj”/„Jutro”, a pozostałe daty w jednej polskiej formie.

**Kryteria akceptacji**

- Żaden ekran nie renderuje surowego `YYYY-MM-DD`.
- Ten sam dzień ma tę samą reprezentację na liście i szczególe.
- Formatter respektuje `workspaceTimezone`.
- Test obejmuje dziś, jutro, datę przeszłą i brak terminu.

## Zalecana kolejność realizacji

1. ACT-02 — widoczna przyczyna blokady.
2. ACT-01 — edycja z każdego szczegółu.
3. ACT-03 — poprawne znaczenie licznika w Celu.
4. ACT-04 i ACT-05 — wspólny wzorzec karty Działania.
5. ACT-06 — semantyka i czytelność terminu w Quick Add.
6. ACT-07 — pełne pochodzenie z Rutyny.
7. ACT-08 i ACT-09 — porządki oraz spójność.

## Sugerowany podział implementacji

- `ActionDetailPage.tsx`: ACT-01, ACT-02, ACT-08.
- `GoalDetailPage.tsx`: ACT-03, część ACT-04 i ACT-09.
- `ProjectDetailPage.tsx`: ACT-05, część ACT-04 i ACT-09.
- `StartPage.tsx`: część ACT-04.
- `QuickAdd.tsx`: ACT-06.
- `ActionStatusControls.tsx`: współdzielone warianty statusu oraz blokady.
- Nowy współdzielony komponent, np. `ActionSummary.tsx`: tytuł, status, kontekst, termin, pochodzenie i blokada używane na wszystkich listach.
- Nowy helper domenowy, np. `formatActionSchedule.ts`: spójny termin i etykieta pilności.

## Minimalny zestaw testów regresji

1. Szczegół zablokowanego Działania pokazuje `action.blocker` bez otwierania dialogu.
2. Szczegół każdego rodzaju Działania pozwala je edytować.
3. Cel z jednym następnym krokiem pokazuje „Pozostałe Działania 0”.
4. Start, Projekt i Cel pokazują tekst statusu.
5. Projekt pokazuje termin i powód blokady.
6. Quick Add udostępnia termin jako pojedynczy wybór i poprawnie czyści datę.
7. Działanie z Rutyny pokazuje nazwę serii.
8. Wszystkie powierzchnie używają tego samego formattera dat.

## Mocne strony

- Główna lista Działań ma już czytelne grupowanie według pilności.
- Status można zmienić bez opuszczania kontekstu.
- Ścieżki Projekt → Cel → Działanie są zachowane w breadcrumbach.
- Główne obszary dotykowe są duże, a formularze mają widoczne etykiety.
- Zmiany statusu mają mechanizm cofnięcia.

## Ryzyka dostępności i granice audytu

- Zrzuty i drzewo dostępności potwierdzają widoczną treść, kolejność oraz role części kontrolek, ale nie potwierdzają pełnej zgodności z WCAG.
- Nie wykonano pełnego przejścia samą klawiaturą ani testu VoiceOver/TalkBack.
- Wzajemnie wykluczające się terminy w Quick Add powinny zostać zweryfikowane z czytnikiem ekranu po zmianie na `radiogroup`.
- Kontrast oceniono wizualnie; nie wykonywano pomiaru liczbowego dla każdego tokenu.
- Nie zapisywano ani nie zmieniano żadnych danych podczas audytu.

## Stan kroków przepływu

1. Start / „Na dziś” — **średni**: szybki dostęp działa, lecz statusy są ikonami bez tekstu.
2. Projekt / Działania — **wymaga poprawy**: dobry filtr, ale za mało informacji w wierszu.
3. Szczegół zwykłego Działania — **wymaga poprawy**: czytelny, lecz brak edycji i dużo pustych sekcji.
4. Cel / Następne Działanie — **wymaga poprawy**: mocne wyróżnienie kroku, ale sprzeczny licznik.
5. Dodawanie Działania — **średni**: bezpieczne domyślne wartości, lecz niejednoznaczny wybór terminu.
6. Działanie z Rutyny — **średni**: pochodzenie jest widoczne, ale bez nazwy serii.
7. Zablokowane Działanie — **słaby**: najważniejszy powód blokady jest ukryty.
