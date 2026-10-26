# Audyt UI UX aplikacji Command

Data: 4 października 2026. Audyt aktualnego drzewa roboczego, łącznie z niezacommitowanymi zmianami obecnymi przed audytem.

## Wynik i zakres

Zapisano **29 pozycji do poprawy: 5 o wysokim priorytecie, 20 o średnim i 4 usprawnienia na później**. Najpierw należy poprawić niewidoczne przyciski Projektu na telefonie, dostęp do starszych wpisów Skrzynki, zachowanie filtrów Działań, powrót do poprzedniego kontekstu oraz kontrast pustych pól formularzy.

To przegląd szerokiego zakresu aplikacji, nie gwarancja wykrycia wszystkich możliwych błędów. Obejmuje obserwację interfejsu w lokalnym trybie demo, analizę kodu i wybrane istniejące testy. Nie sprawdzano kont produkcyjnych ani trwałego zapisu w zdalnym backendzie. Nie zmieniano kodu aplikacji; wyniki audytu zapisano w tym katalogu.

Założenie: użytkownik korzysta z aplikacji jako osobistego systemu codziennej pracy. Projekty przechowują kontekst, Cele opisują wyniki, Działania służą wykonaniu pracy, Wiedza i Skrzynka porządkują materiały, a Przegląd wspiera planowanie tygodnia. Priorytety wynikają z wpływu na te zadania.

Przejrzane widoki: Start, Projekty i szczegóły Projektu, Rutyny, Cele i szczegóły Celu, Działania i szczegóły Działania, Biblioteka, szczegóły materiału i książki, Skrzynka i przetwarzanie wpisu, Przegląd i plan tygodnia, Ustawienia, wyszukiwanie globalne, szybkie dodawanie oraz okno kontekstu do AI. Sprawdzono szerokości 1440, 390, 320 i 768 px. Kontrola 320 i 768 px obejmowała cztery główne listy: Projekty, Cele, Działania i Wiedzę.

Oznaczenia dowodów:

- **B** — odtworzone lub zmierzone w przeglądarce.
- **K** — wynika z kodu; warunek lub skutek nie został w pełni odtworzony z rzeczywistym backendem.
- **U** — ocena użyteczności lub hierarchii wizualnej; wymaga decyzji projektowej, nie oznacza awarii funkcji.

P1 oznacza problem utrudniający odnalezienie funkcji, danych lub właściwego kontekstu. P2 oznacza lokalny błąd, niespójność albo istotne tarcie. P3 oznacza usprawnienie wygody i czytelności. Każda pozycja podaje osobno poprawkę i warunek jej odbioru.

## P1 Najważniejsze poprawki

### UX-01 Niewidoczne przyciski w nagłówku Projektu na telefonie

**Dowód: B + K.** Przy szerokości 390 px przyciski „Przekaż kontekst do AI” i „Szablon: Standardowy” mają rozmiar 48 × 44 px, tekst o rozmiarze 0 px i nie zawierają ikon. Wyglądają jak puste miejsca. Reguła `.project-detail-head .button` ukrywa tekst każdego przycisku, chociaż nowe przyciski są tekstowe.

**Poprawić:** ograniczyć regułę do przycisków rzeczywiście zawierających ikonę. Dla AI i szablonu zapewnić widoczne etykiety lub rozpoznawalne ikony z dostępną nazwą; dopasować układ nagłówka.

**Odbiór:** oba działania są widoczne i zrozumiałe przy 320 i 390 px, mają czytelny fokus i można je uruchomić dotykiem oraz klawiaturą.

Źródła: [styles.css:620](/Users/jakub/Documents/project-learning-app/apps/web/src/styles.css:620), [ProjectDetailPage.tsx:231](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/ProjectDetailPage.tsx:231), [zrzut przycisków](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/project-invisible-buttons-mobile.png).

### UX-02 Skrzynka może pokazywać pusty stan mimo starszych wpisów danego statusu

**Dowód: K; problem zależy od liczby i rozkładu wpisów.** Skrzynka pobiera stronę 50 wpisów bez filtra statusu, następnie filtruje już pobrane dane. Przycisk „Załaduj starsze” wymaga jednocześnie `visible.length` i `hasNextPage`. Jeżeli pobrane wpisy mają inne statusy, a starsze pasujące wpisy są na kolejnej stronie, widok jest pusty i nie pozwala ich pobrać. Liczniki zakładek również opisują pobrane dane, niekoniecznie pełną Skrzynkę.

**Poprawić:** filtrować status przed paginacją i określić źródło liczników. Co najmniej umożliwić dalsze pobieranie przy `hasNextPage`, także przy zerowej liczbie widocznych wpisów. Pusty stan pokazywać dopiero po rozstrzygnięciu, że pasujących wpisów nie ma.

**Odbiór:** zestawy 51 i 101 wpisów, z pierwszą stroną innego statusu, nadal pozwalają znaleźć starsze „Nowe”, „Odłożone” i „Przetworzone”. Licznik nie sugeruje pełnej liczby, jeśli jest częściowy. Wymaga testu z backendem; nie stwierdzono usunięcia danych.

Źródło: [InboxPage.tsx:34](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/InboxPage.tsx:34), filtrowanie około 65–66, liczniki i przycisk około 159–163.

### UX-03 Filtry statusu i terminu Działań wzajemnie się zastępują

**Dowód: B + K.** Status i termin korzystają z tego samego parametru `view`. Wybranie „W toku” usuwa możliwość równoczesnego użycia terminu; wybranie skrótu „Zaległe” przywraca status „Otwarte”. Interfejs przedstawia je jako odrębne kryteria, ale nie pozwala ich połączyć.

**Poprawić:** przechowywać status i termin oddzielnie oraz stosować oba warunki do listy. Ujednolicić skróty, panel filtrów, liczniki, adres URL i zapisane widoki. Zachować obsługę dotychczasowych linków.

**Odbiór:** „W toku” + „Zaległe” działa jednocześnie i pozostaje wybrane po zamknięciu panelu, odświeżeniu, użyciu Wstecz oraz zapisaniu widoku. Zmiana Projektu lub Celu nie kasuje tych filtrów.

Źródło: [ActionsPage.tsx:103](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/ActionsPage.tsx:103), funkcje zapisu około 171–181; [widok mobilny filtrów](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/actions-mobile-filters.png).

### UX-04 Zmiana zakładki Projektu kasuje kontekst powrotu

**Dowód: B + K.** Po wejściu z Celu do Projektu link powrotu wskazuje nazwę Celu. Po wybraniu zakładki „Wiedza” zmienia się na „Wszystkie Projekty”. Aktualizacja parametrów wyszukiwania nie zachowuje `location.state`, z którego korzysta nawigacja kontekstowa.

**Poprawić:** zachowywać stan pochodzenia przy zmianie zakładek i filtrów Projektu. Po powrocie odtworzyć właściwy widok źródłowy oraz, gdy zapisano ten kontekst, pozycję przewijania i fokus.

**Odbiór:** Cel → Projekt → Wiedza lub filtr → link powrotu prowadzi do tego samego Celu. Sprawdzić również wejście z Działania, Startu i wyników wyszukiwania oraz zwykłe wejście z listy Projektów.

Źródła: [ProjectDetailPage.tsx:110](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/ProjectDetailPage.tsx:110), [ContextNavigation.tsx:22](/Users/jakub/Documents/project-learning-app/apps/web/src/components/ContextNavigation.tsx:22).

### UX-05 Zbyt słabo widoczne granice pustych pól formularzy

**Dowód: B + K.** Zmierzona obwódka `#2b3d56` ma kontrast około 1,52:1 z wnętrzem pola `#101e31` i 1,72:1 z tłem `#07111f`. Samo wnętrze pola odcina się od tła około 1,13:1. Przy pustym polu trudno rozpoznać jego obszar. Dotyczy wspólnego stylu `input`, `textarea`, `select`, m.in. formularza nowego Projektu.

**Poprawić:** użyć tokenu obramowania przeznaczonego dla kontrolek, sprawdzając rzeczywiste tło każdego formularza. Zapewnić wyraźny stan spoczynku i fokusu. Nie ma potrzeby wzmacniać wszystkich dekoracyjnych obramowań kart.

**Odbiór:** istotna granica pustej kontrolki ma co najmniej 3:1 względem sąsiedniego koloru, jeżeli jest potrzebna do jej rozpoznania. Sprawdzić stronę, modal i panel mobilny; nie opierać pomiaru wyłącznie na jednym tle. Kryterium wynika z [WCAG 2.2, objaśnienie kontrastu elementów nietekstowych](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Źródła: [styles.css:76](/Users/jakub/Documents/project-learning-app/apps/web/src/styles.css:76), [formularz Projektu](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/new-project-mobile.png).

## P2 Błędy i niespójności do poprawy

### UX-06 Niespójna semantyka i obsługa klawiatury w zakładkach

**Dowód: B + K.** Wiedza, Skrzynka i Projekt używają `tablist`/`tab`, ale brakuje kompletnego powiązania z panelami i obsługi strzałek. W Wiedzy strzałka w lewo na zakładce „Skrzynka” nie przenosi fokusu na „Biblioteka”. Komponent używany w Celach zawiera przyciski `aria-pressed` w `tablist`. Przegląd ma pełniejszą obsługę i może posłużyć jako wzorzec.

**Poprawić:** wdrożyć wspólny wzorzec zakładek z fokusem, `aria-selected`, powiązaniami i panelami; dla przycisków filtrujących zastosować właściwą grupę zamiast deklarować zakładki. **Odbiór:** Tab wchodzi na aktywną zakładkę, strzałki zmieniają fokus, wybór działa zgodnie z przyjętym sposobem aktywacji, panel ma nazwę. Brak strzałek nie oznacza, że całość jest nieobsługiwalna klawiaturą. Punkt odniesienia: [WAI ARIA APG Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

Źródła: [KnowledgePage.tsx:209](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/KnowledgePage.tsx:209), [InboxPage.tsx:159](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/InboxPage.tsx:159), [ProjectDetailPage.tsx:234](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/ProjectDetailPage.tsx:234), [tabs.tsx:16](/Users/jakub/Documents/project-learning-app/apps/web/src/components/ui/tabs.tsx:16).

### UX-07 Zagnieżdżony główny obszar strony w szczegółach Działania

**Dowód: B + K.** `ActionDetailPage` renderuje `<main>` wewnątrz `<main>` powłoki aplikacji. **Poprawić:** pozostawić jeden główny landmark, a wewnętrzny układ oznaczyć sekcją lub zwykłym kontenerem. **Odbiór:** szczegóły Działania mają jeden główny obszar w drzewie dostępności, z zachowaną strukturą nagłówków i nazwanymi sekcjami pobocznymi.

Źródła: [AppShell.tsx:197](/Users/jakub/Documents/project-learning-app/apps/web/src/components/AppShell.tsx:197), [ActionDetailPage.tsx:96](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/ActionDetailPage.tsx:96).

### UX-08 Aktywny filtr Celów jest słabo odróżniony od pozostałych

**Dowód: B + K.** „Aktywny” i niewybrane „Wstrzymany” mają ten sam kolor tekstu; tło aktywnego przycisku pokrywa się z tłem strony. `aria-pressed` przekazuje wybór programowo, lecz wizualnie stan jest nieczytelny. **Poprawić:** dodać jednoznaczną formę zaznaczenia, np. wypełnienie lub podkreślenie. **Odbiór:** aktywny stan jest czytelny także bez rozróżniania barw, a fokus ma osobne oznaczenie.

Źródła: [GoalsPage.tsx:48](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/GoalsPage.tsx:48), [tabs.tsx:20](/Users/jakub/Documents/project-learning-app/apps/web/src/components/ui/tabs.tsx:20), [Cele na desktopie](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/goals-desktop.png).

### UX-09 Domyślny filtr Celów na telefonie pozostaje ukryty

**Dowód: B + K + U.** Lista domyślnie pokazuje aktywne Cele, ale zamknięty panel opisuje się jako „Filtry (0)”. Poza panelem nie widać, że lista pomija inne statusy. **Poprawić:** pokazywać podsumowanie bieżącego zakresu, np. „Aktywne · wszystkie typy”, niezależnie od licznika filtrów dodatkowych. **Odbiór:** użytkownik rozpoznaje zakres listy bez otwierania panelu i może łatwo przejść do wszystkich statusów.

Źródła: [GoalsPage.tsx:45](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/GoalsPage.tsx:45), [Cele na telefonie](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/goals-mobile.png).

### UX-10 Stan Celu jest ukryty w menu opcji

**Dowód: B + K + U.** Kontrolka „Stan Celu” znajduje się w rozwijanych opcjach; główna część szczegółów nie daje równie wyraźnej informacji o aktualnym stanie. **Poprawić:** wyświetlać stan przy nazwie lub metadanych Celu, pozostawiając zmianę w kontrolce. **Odbiór:** stan aktywny, wstrzymany i zakończony rozpoznaje się bez otwierania menu; nie jest mylony z archiwizacją lub koszem.

Źródła: [GoalDetailPage.tsx:221](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/GoalDetailPage.tsx:221), [szczegóły Celu](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/goal-detail-mobile.png).

### UX-11 Pierwszy krok przetwarzania Skrzynki nie pokazuje wybranego wpisu

**Dowód: B + K + U.** Okno „Co chcesz z tym zrobić?” pokazuje wybór rodzaju i opcje AI, ale nie pokazuje treści przetwarzanego wpisu. Użytkownik musi ją pamiętać z zasłoniętej listy. **Poprawić:** umieścić krótki podgląd źródła z możliwością rozwinięcia i czytelnym adresem dla linków. **Odbiór:** źródło jest rozpoznawalne w pierwszym i kolejnych krokach, również przy kilku podobnych wpisach.

Źródła: [InboxPage.tsx:166](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/InboxPage.tsx:166), [okno przetwarzania](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/inbox-triage-desktop.png).

### UX-12 „Asystuj AI” otwiera ten sam pierwszy krok co „Przetwórz”

**Dowód: B + K.** Oba przyciski wywołują `open(candidate)` i otwierają identyczny stan. **Poprawić:** skierować skrót AI do odpowiedniej części okna lub połączyć redundantne działania. **Odbiór:** etykieta trafnie zapowiada następny ekran; użytkownik widzi, co wybrał, a uruchomienie analizy nadal ma czytelną, zamierzoną akcję.

Źródło: [InboxPage.tsx:161](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/InboxPage.tsx:161).

### UX-13 Utworzenie Celu wymaga różnych pól zależnie od miejsca

**Dowód: K.** Na liście Celów i w Projekcie pusty wynik Celu otrzymuje wartość nazwy. W przetwarzaniu Skrzynki przycisk zapisu wymaga osobnego wyniku. **Poprawić:** uzgodnić jedną minimalną definicję Celu i zastosować ją we wszystkich formularzach; jawnie oznaczyć wymagane i opcjonalne pola. **Odbiór:** ten sam zestaw danych pozwala utworzyć Cel w każdym miejscu lub wszędzie daje ten sam komunikat brakującego pola.

Źródła: [GoalsPage.tsx:90](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/GoalsPage.tsx:90), [ProjectDetailPage.tsx:177](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/ProjectDetailPage.tsx:177), [InboxPage.tsx:171](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/InboxPage.tsx:171).

### UX-14 Notatka bez daty pokazuje 1 stycznia 1970

**Dowód: B + K.** Data notatki używa wartości `updatedAt ?? createdAt ?? 0`. Brak obu dat tworzy datę epoki Unix, widoczną w danych demo. **Poprawić:** ukryć brakującą datę lub pokazać „Brak daty”; nie zastępować jej zerem. Ujednolicić format i strefę czasową. **Odbiór:** starsza notatka bez metadanych nie otrzymuje fikcyjnej daty, a poprawna data nadal wyświetla się zgodnie z ustawieniami przestrzeni.

Źródła: [KnowledgeDetailPage.tsx:229](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/KnowledgeDetailPage.tsx:229), [notatki książki](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/book-progress-mobile.png).

### UX-15 Techniczny format dat w podglądzie Rutyny i historii Przeglądu

**Dowód: B dla formularza Rutyny, K dla historii.** Podgląd kolejnych wystąpień pokazuje ciąg `2026-10-04 · 2026-10-11…`; część historii Przeglądu wypisuje surowe wartości dat lub ich fragmenty. **Poprawić:** użyć wspólnego polskiego formatowania dat, zgodnego ze strefą przestrzeni. **Odbiór:** podgląd jest zrozumiały, rozróżnia lata i nie zmienia dnia przy zmianie strefy przeglądarki.

Źródła: [QuickAdd.tsx:319](/Users/jakub/Documents/project-learning-app/apps/web/src/components/QuickAdd.tsx:319), [ReviewPage.tsx:359](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/ReviewPage.tsx:359), [formularz Rutyny](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/new-routine-mobile.png).

### UX-16 „Wyczyść datę” nie zapisuje usunięcia i nie sygnalizuje oczekującej zmiany

**Dowód: K + U.** Przycisk tylko czyści pole lokalnego formularza. Dopiero „Zapisz” aktualizuje materiał. Brakuje oznaczenia niezapisanej zmiany, a komunikat po zapisie mówi o pozycji czytania również dla zwykłej notatki. **Poprawić:** określić model działania: wyczyszczenie pola z wyraźnym stanem „Niezapisane zmiany” albo natychmiastowa operacja z cofnięciem. Dopasować komunikat do zapisanych danych. **Odbiór:** użytkownik jednoznacznie rozumie, kiedy data została usunięta z materiału; powrót do widoku potwierdza oczekiwany wynik.

Źródła: [KnowledgeReadingProgress.tsx:24](/Users/jakub/Documents/project-learning-app/apps/web/src/components/KnowledgeReadingProgress.tsx:24), [data powrotu](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/knowledge-return-mobile.png).

### UX-17 Edycja pozycji czytania może zniknąć po zmianie wersji materiału

**Dowód: K; nie odtwarzano zapisu ani konfliktu z backendem.** Formularz przechowuje wartości tylko lokalnie i jest montowany z kluczem `id:version`. Zmiana wersji ponownie go montuje. Pola pozostają edytowalne podczas zapisu, więc tekst wpisany po rozpoczęciu operacji może również zniknąć przy odświeżeniu. **Poprawić:** zachować szkic lub obsłużyć niezapisane zmiany i konflikt wersji; zablokować edycję podczas zapisu albo bezpiecznie zachować późniejsze zmiany. **Odbiór:** zmiana statusu, odświeżenie danych i zapis przy wolnej sieci nie kasują wpisanej wartości bez wyjaśnienia.

Źródła: [KnowledgeDetailPage.tsx:190](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/KnowledgeDetailPage.tsx:190), [KnowledgeReadingProgress.tsx:11](/Users/jakub/Documents/project-learning-app/apps/web/src/components/KnowledgeReadingProgress.tsx:11).

### UX-18 Ustawienia nie chronią niezapisanych zmian

**Dowód: K.** Formularz przechowuje wartości w lokalnym stanie. `dirty` steruje przyciskiem zapisu, lecz nie chroni przejścia na inną stronę. **Poprawić:** zachować szkic albo wyświetlić ostrzeżenie przy opuszczeniu zmienionego formularza. **Odbiór:** zmiana strefy lub preferencji, przejście do innego widoku i powrót nie prowadzą do cichej utraty edycji; zapisane ustawienia nie wywołują zbędnego ostrzeżenia.

Źródło: [SettingsPage.tsx:12](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/SettingsPage.tsx:12).

### UX-19 Wyszukiwanie dodatkowych źródeł AI nie wyjaśnia braku wyników

**Dowód: K.** Zapytanie uruchamia się od dwóch znaków, lecz panel nie informuje o tym minimum, wczytywaniu ani zerowej liczbie wyników. Pokazuje tylko błąd lub znalezione rekordy. **Poprawić:** dodać stany krótkiego zapytania, oczekiwania i braku wyników, z komunikatem dostępnym dla czytnika ekranu. **Odbiór:** po „Szukaj” przy jednym znaku, po poprawnej pustej odpowiedzi oraz przy wolnej sieci widać właściwy komunikat; wyniki jednoznacznie odnoszą się do wykonanego zapytania.

Źródło: [AIContextExport.tsx:25](/Users/jakub/Documents/project-learning-app/apps/web/src/components/AIContextExport.tsx:25), renderowanie około 45.

### UX-20 Komunikaty z „Cofnij” wygasają także podczas pracy z nimi

**Dowód: K.** Standardowy czas wynosi osiem sekund. Nie ma zatrzymania licznika przy fokusie ani najechaniu. Zwykłe komunikaty błędu również wygasają po ośmiu sekundach; błędy nieudanego cofnięcia są już utrzymywane. **Poprawić:** zatrzymywać wygaszanie podczas interakcji i zapewnić odpowiednią trwałość komunikatów wymagających działania. **Odbiór:** fokus na „Cofnij” nie znika z odliczanym elementem, komunikat błędu można przeczytać i zamknąć świadomie, a zwykłe potwierdzenia nadal nie zasłaniają aplikacji bez potrzeby.

Źródło: [ActionFeedback.tsx:22](/Users/jakub/Documents/project-learning-app/apps/web/src/components/ActionFeedback.tsx:22).

### UX-21 Brakuje skrótu do głównej treści

**Dowód: K + U.** Powłoka umieszcza stałą nawigację przed treścią, bez widocznego przy fokusie linku pomijającego ją. **Poprawić:** dodać na początku kolejności fokusu „Przejdź do treści”, prowadzący do głównego obszaru strony. **Odbiór:** użytkownik klawiatury może dotrzeć do treści jednym skrótem, cel ma prawidłowy fokus i działa na każdej głównej trasie.

Źródło: [AppShell.tsx:166](/Users/jakub/Documents/project-learning-app/apps/web/src/components/AppShell.tsx:166).

### UX-22 Oznaczenie książki ma inny układ niż pozostałe typy Wiedzy

**Dowód: B + K.** Na telefonie „Książka” znajduje się po prawej stronie niżej w wierszu, podczas gdy inne typy korzystają ze wspólnego oznaczenia przy treści. Książka używa ogólnego `Badge`, a reguły mobilne układają `knowledge-kind-badge` osobno. Nie stwierdzono poziomego przepełnienia tej etykiety. **Poprawić:** ujednolicić kontener metadanych i reguły siatki dla wszystkich typów, również z datą powrotu. **Odbiór:** typ materiału zajmuje przewidywalne miejsce przy 320 i 390 px, z krótkim i długim tytułem.

Źródła: [KnowledgePage.tsx:267](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/KnowledgePage.tsx:267), [Biblioteka na telefonie](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/knowledge-mobile.png).

### UX-23 Szablon Projektu nazywany jest kategorią

**Dowód: B + K.** Pomocniczy tekst „Propozycja kategorii: Standardowy” opisuje szablon, a nie kategorię Projektu. **Poprawić:** użyć „Proponowany szablon” i wyjaśnić związek z wybraną kategorią; przy braku kategorii opisać szablon domyślny. **Odbiór:** słowa „kategoria” i „szablon” mają spójne znaczenie w formularzu i szczegółach Projektu.

Źródła: [ProjectPresetPicker.tsx:20](/Users/jakub/Documents/project-learning-app/apps/web/src/components/ProjectPresetPicker.tsx:20), [formularz Projektu](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/new-project-mobile.png).

### UX-24 Puste stany kierują „na dole”, także gdy przycisk jest na górze

**Dowód: K.** Opisy pustych list w Projekcie i Wiedzy odwołują się do dodawania „na dole”. Pozycja kontrolki zależy od układu urządzenia. **Poprawić:** wskazywać nazwę działania, np. „Wybierz Dodaj”, lub umieścić właściwą akcję bezpośrednio w pustym stanie. **Odbiór:** instrukcja pasuje do desktopu i telefonu, a wskazana akcja jest dostępna i prowadzi do odpowiedniego formularza.

Źródła: [ProjectDetailPage.tsx:260](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/ProjectDetailPage.tsx:260), również około 283 i 289; [KnowledgePage.tsx:279](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/KnowledgePage.tsx:279).

### UX-25 Panel zamknięcia Przeglądu ma za małe odstępy na desktopie

**Dowód: B + K + U.** Treść panelu kończącego Przegląd przylega do lewej krawędzi; jego podstawowy padding to 4 px / 2 px / 10 px, podczas gdy większy padding ustawiono dla telefonu. **Poprawić:** ujednolicić odstępy z pozostałymi panelami i zachować czytelną hierarchię końcowej decyzji oraz przycisku. **Odbiór:** panel przy 1440 i 768 px ma czytelną przestrzeń przy krawędziach, treść nie przylega do obramowania, a poprawka nie pogarsza wersji mobilnej.

Źródła: [styles.css:4421](/Users/jakub/Documents/project-learning-app/apps/web/src/styles.css:4421), [Przegląd na desktopie](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/review-desktop.png).

## P3 Usprawnienia na później

### UX-26 Pusty blok ulubionych widoków zwiększa wysokość nagłówka Działań

**Dowód: B + K + U.** „Ulubione widoki (0/5)” zajmuje osobny blok również bez zapisanych widoków. Razem z filtrami odsuwa pierwsze Działania od góry strony. **Poprawić:** dla pustej kolekcji zastosować zwięzłą akcję „Zapisz widok”; rozwinąć listę, gdy użytkownik ma co wybierać. **Odbiór:** zapis widoku pozostaje łatwy do znalezienia, lecz pusty blok nie zabiera osobnej sekcji przed listą.

Źródła: [SavedActionViews.tsx](/Users/jakub/Documents/project-learning-app/apps/web/src/components/SavedActionViews.tsx), [Działania z filtrami](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/actions-filters-desktop.png).

### UX-27 Start powtarza ten sam kontekst Działania na desktopie

**Dowód: B + K.** W wierszu występują równocześnie pełny i skrócony wariant linku kontekstowego. Dla badanego Działania wyświetlają ten sam Cel dwa razy. **Poprawić:** ustawić wzajemnie wykluczającą się widoczność wariantów lub połączyć je w jedną linię. **Odbiór:** na desktopie i telefonie jest jeden link danego kontekstu; odrębne relacje Projektu i Celu mogą nadal być pokazane.

Źródła: [StartPage.tsx:53](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/StartPage.tsx:53), [Start na desktopie](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/start-desktop.png).

### UX-28 Tytuły kolejnego kroku w kartach Projektów są za wcześnie skracane

**Dowód: B + U.** W desktopowej siatce czterech kolumn ważny następny krok zostaje ucięty wielokropkiem. **Poprawić:** pozwolić na dwie linie lub zapewnić dostęp do pełnego tytułu przy fokusie i na urządzeniu dotykowym. **Odbiór:** można rozpoznać następny krok z listy bez otwierania każdego Projektu; bardzo długi tytuł nie rozsadza siatki.

Dowód: [Projekty na desktopie](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/projects-desktop.png).

### UX-29 Formularz pozycji czytania odsuwa właściwą treść materiału

**Dowód: B + U.** Sekcja daty powrotu / pozycji czytania znajduje się przed treścią materiału. Rozwinięta sekcja książki zajmuje znaczną część ekranu telefonu i odsuwa notatki. **Poprawić:** pozostawić zwięzłe podsumowanie postępu przy metadanych, a edycję przenieść do osobnego panelu lub umieścić po głównej treści. **Odbiór:** treść i wnioski są łatwo dostępne przy otwarciu książki, a aktualizacja pozycji nie wymaga szukania funkcji.

Źródła: [KnowledgeDetailPage.tsx:190](/Users/jakub/Documents/project-learning-app/apps/web/src/pages/KnowledgeDetailPage.tsx:190), [pozycja czytania książki](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots/book-progress-mobile.png).

## Kolejność wdrożenia i ryzyko zmian

| Etap | Pozycje | Korzyść | Co jest potrzebne | Ryzyko do sprawdzenia |
| --- | --- | --- | --- | --- |
| 1. Widoczność i powrót | UX-01, 04, 05, 14, 23, 24, 27 | Funkcje są widoczne, kontekst nie znika, interfejs nie podaje fałszywych informacji | Lokalne poprawki CSS, nawigacji i tekstów | Regresje innych przycisków mobilnych, tła modali, prawidłowe wejście bez kontekstu |
| 2. Filtry i kompletność danych | UX-02, 03, 09, 13 | Użytkownik znajduje właściwe dane i tworzy Cel według jednej reguły | Wspólny model filtrów, kontrakt paginacji i walidacji | Istniejące adresy URL, zapisane widoki, różnica między licznikami lokalnymi a pełnymi |
| 3. Klawiatura i komunikaty | UX-06, 07, 08, 19, 20, 21 | Stan i wynik operacji są czytelne, obsługa klawiaturą przewidywalna | Wspólny komponent zakładek, uporządkowane landmarki i komunikaty | Fokus po zmianie listy, wygaszanie komunikatów, czytniki ekranu |
| 4. Bezpieczna edycja i przetwarzanie | UX-10, 11, 12, 15, 16, 17, 18 | Mniej pomyłek i utraconej pracy, prostsze przetwarzanie wpisu | Uzgodniona semantyka zapisu i szkiców, wspólny format dat | Konflikty wersji, wolna sieć, niezamierzone kasowanie szkicu |
| 5. Hierarchia wizualna | UX-22, 25, 26, 28, 29 | Łatwiejsze skanowanie list i dostęp do treści | Korekta układu na podstawie tych samych przykładowych danych | Długie tytuły, nowe etykiety, 320 px oraz tablet |

Proponowane decyzje projektowe przed wdrożeniem większych zmian:

1. **Status i termin Działań traktować jako niezależne filtry.** To odpowiada obecnemu sposobowi ich prezentacji i pozwala naprawić UX-03 bez zmiany celu widoku.
2. **Ustalić jeden minimalny formularz Celu.** Rekomendacja: nazwa wymagana, wynik oznaczony jawnie zgodnie z wybraną regułą domenową, identycznie w Celach, Projekcie i Skrzynce.
3. **Ujednolicić model edycji.** Rekomendacja: jawny zapis z oznaczeniem niezapisanych zmian; szkice dla dłuższej pracy, blokada lub zachowanie późniejszej edycji podczas operacji sieciowej. Nie mieszać go z pozornie natychmiastowym „Wyczyść”.

## Co sprawdzono i czego jeszcze nie można potwierdzić

W lokalnym demo główne listy przy 320 i 768 px nie miały poziomego przepełnienia strony ani elementów kontrolnych wychodzących poza obszar treści. To wynik dla badanych danych, nie wszystkich możliwych tytułów i stanów. Pomiary są zapisane w [responsive-checks.json](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/responsive-checks.json). Osiem zapisanych plików `*-dom.txt` dokumentuje te same listy.

Wyszukiwanie globalne poprawnie odróżnia krótki tekst, wczytywanie i brak wyników. Mobilne szybkie dodawanie ma dostępne akcje zapisu; badane pola miały czytelny rozmiar tekstu. Zakładki Przeglądu mają obsługę klawiatury, którą warto wykorzystać przy UX-06. W jednorazowej kontroli logów konsoli na widoku Wiedzy nie znaleziono ostrzeżeń ani błędów.

**Wybrane istniejące testy: 93 zaliczone testy w 10 plikach.** Obejmowały regresje aplikacji, nawigację, Działania, doświadczenie Celu, mobilne kończenie Działań, Wiedzę, szczegóły Wiedzy, Skrzynkę, kontekst AI i pozycję czytania. Nie uruchamiano pełnego zestawu testów ani procesu budowania. Wynik tych testów nie zastępuje wizualnego odbioru i nie dowodzi, że powyższe problemy nie występują.

Pozostałe scenariusze wymagające odrębnej weryfikacji:

- **Rzeczywisty backend:** paginacja i liczniki Skrzynki przy ponad 50 wpisach, kompletność wyników wyszukiwania, duże kolekcje, wolna sieć, brak połączenia, błędy zapisu i konflikty dwóch edycji. UX-02 i UX-17 wymagają takich testów przed zamknięciem zgłoszenia.
- **Logowanie i odzyskiwanie dostępu:** w kodzie ekranu autoryzacji nie znaleziono ścieżki resetowania hasła ani ponownego wysłania potwierdzenia. Trzeba sprawdzić wymagania produktu, obsługę odrzuconej obietnicy zapisu/logowania, zakończenie stanu oczekiwania i czytelność komunikatów dostawcy. Nie badano tego na prawdziwym koncie; nie zaliczono do głównej listy 29 pozycji.
- **Czytniki ekranu i modale:** sprawdzić VoiceOver lub NVDA, izolację tła dla modali zagnieżdżonych wewnątrz strony, powrót fokusu, komunikaty błędów i zmian tras. Sama inspekcja DOM nie potwierdza rzeczywistego zachowania czytnika.
- **Urządzenie fizyczne:** Safari z klawiaturą ekranową, bezpieczny obszar dolnej nawigacji, tryb PWA, orientacja pozioma. Emulacja szerokości nie odtwarza wszystkich tych warunków.
- **Dostępność w rozszerzonym zakresie:** powiększenie 200% i 400%, odstępy tekstu, ograniczony ruch, pełny pomiar kontrastu tekstów i stanów kontrolek. Ten raport nie jest certyfikacją zgodności z WCAG.

## Materiały dowodowe

W katalogu [screenshots](/Users/jakub/Documents/project-learning-app/docs/audits/2026-10-04-ui-ux/screenshots) zapisano **36 zrzutów**. Nazwy wskazują widok i szerokość / urządzenie. Najważniejsze są podlinkowane przy zgłoszeniach. Dodatkowe zrzuty obejmują m.in. plan tygodnia, szybkie dodawanie, Ustawienia, wyszukiwanie oraz główne listy przy 320 i 768 px.

Zrzuty całej strony utrwalają dolną, stałą nawigację w pozycji odpowiadającej pierwotnemu viewportowi. Jej położenie w środku wysokiego obrazu samo w sobie nie jest dowodem zasłaniania treści podczas zwykłego przewijania.

Źródła normatywne użyte do kryteriów UX-05 i UX-06: dokumentacja W3C podlinkowana przy tych pozycjach. Pozostałe wnioski wynikają z lokalnej aplikacji, jej kodu i zapisanych dowodów.
