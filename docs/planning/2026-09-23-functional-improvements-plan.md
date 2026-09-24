# Plan rozwoju funkcjonalnego: od decyzji do działania

Data: 23 września 2026. Status: propozycja do realizacji, bez zmian w aplikacji.

## Cel i punkt wyjścia

Command ma już Projekty, Cele, Działania, Rutyny, Skrzynkę, Bibliotekę Wiedzy
oraz Podsumowanie tygodnia. Następny etap powinien skracać drogę od przeglądu
spraw do wykonania konkretnego kroku oraz pomagać wracać do kontekstu po
przerwie. Zakładamy prywatny Workspace jednej osoby; nie projektujemy tutaj
współpracy zespołowej.

Ten plan rozwija pięć pomysłów z rozmowy. Jest węższy od
[audytu funkcjonalnego z 7 września](./product-roadmap-audit-2026-09-07.md):
nie powtarza już wdrożonej listy Działań ani obecnego szybkiego dodawania.
Zachowuje zasady [trwałych Projektów i prostych Celów](./project-centered-hierarchy.md).

| Kolejność | Funkcja | Pierwszy rezultat | Zależność |
| --- | --- | --- | --- |
| 1 | Plan tygodnia z Podsumowania | Wybrane Cele i Działania na konkretne dni | Odbiór istniejących zapisów i odczytów |
| 2 | Powrót do blokady | Osobna data sprawdzenia i kolejka oczekujących | Spójny szczegół i lista Działań |
| 3 | Podpowiedzi istniejącej Wiedzy | Rozpoznanie zapisanego linku i łatwe powiązanie | Stabilne wyszukiwanie i relacje Wiedzy |
| 4 | Ulubione widoki pracy | Kilka nazwanych filtrów Działań | Lista Działań z filtrami w URL |
| Warunkowo | Powtórki nauki | Krótka próba przypomnienia powiązana z Celem | Potwierdzenie, że nauka jest głównym użyciem |

## 1. Plan tygodnia z Podsumowania

**Problem.** Podsumowanie pokazuje liczby, sugestie i pozwala zapisać decyzję,
ale nie prowadzi bezpośrednio do rozłożenia istniejących Działań na kolejny
tydzień. Start pokazuje dzisiejszą projekcję, a nie miejsce układania tygodnia.

**Przepływ pierwszej wersji.**

1. W Podsumowaniu użytkownik wybiera od jednego do trzech aktywnych Celów jako
   kierunek tygodnia. Wybór jest propozycją UI, nie nowym limitem domenowym.
2. Dla wybranych Celów widzi otwarte Działania oraz może dodać jeden nowy krok.
   Może również wybrać samodzielne Działanie.
3. Przypisuje wybrane Działania do dni tygodnia albo pozostawia je bez daty.
   Widać istniejące terminy, blokady i wystąpienia Rutyn. Nie przesuwa się
   automatycznie żadnego rekordu.
4. Przed zapisem widzi podgląd zmian. Każda zmiana terminu korzysta z istniejącej
   typowanej komendy, wersji rekordu i undo. Błąd jednego zapisu nie udaje
   sukcesu pozostałych; można ponowić tylko nieudane pozycje.
5. Zamknięcie tygodnia zapisuje wybrane identyfikatory Celów i krótką decyzję
   w wersjonowanym rekordzie Review. Aktualna agenda wynika z dat Działań:
   nie tworzymy drugiej kopii ich statusów ani terminów.
6. Na Starcie widoczny jest dzisiejszy wycinek agendy. Zmiana terminu w innym
   miejscu aktualizuje ją bez dodatkowej synchronizacji planu.

**Warstwa danych.** Bieżąca zdalna funkcja complete_weekly_review zapisuje
podsumowanie tekstowe i stałe answers. Trzeba dodać wersjonowany kontrakt
przyjmujący wybrane ID Celów, walidujący ich Workspace i aktywność. Review
pozostaje historyczną migawką decyzji; późniejszą zmianę kierunku zapisuje nowy
Review, a bieżące terminy nadal są odczytywane z Działań. Demo i Supabase muszą
zwracać tę samą projekcję tygodnia oraz używać strefy Workspace.

**Kryteria odbioru.** Po odświeżeniu i ponownym logowaniu wybrane Cele oraz
przypisane dni są czytelne. Przełożenie jednego wystąpienia Rutyny nie zmienia
serii. Dwa klienty nie nadpisują po cichu starszej wersji Działania. Da się
ukończyć przegląd bez planowania i bez tworzenia pustego planu.

**Ryzyko.** Zbyt sztywny kalendarz zwiększy koszt planowania. Pierwsza wersja
nie ma godzin, przeciągania, synchronizacji kalendarza ani obowiązkowego
planowania wszystkich dni.

## 2. Powrót do blokady

**Problem.** Działanie może mieć status „Zablokowane” i powód, ale termin
wykonania nie mówi, kiedy należy ponownie sprawdzić przeszkodę.

**Przepływ pierwszej wersji.** Przy blokowaniu użytkownik opcjonalnie podaje
datę „Sprawdź ponownie”. Lista „Oczekujące” pokazuje zablokowane Działania,
których data nadeszła, i pozwala od razu otworzyć powód, zmienić datę albo
odblokować. Bez daty Działanie nadal pozostaje na liście zablokowanych.
Osiągnięcie daty nie zmienia statusu automatycznie i nie wysyła powiadomienia.

**Warstwa danych.** Dodać opcjonalne pole daty do Działania, addytywną migrację,
walidację w komendzie i zgodny odczyt w demo oraz Supabase. Data sprawdzenia
jest niezależna od scheduledFor i pinnedToToday. Zmiana jednego wystąpienia
Rutyny nie modyfikuje jej szablonu. Zachować wersjonowanie, undo i izolację RLS.

**Kryteria odbioru.** Blokada z datą pojawia się we właściwym dniu także po
reloadzie; blokada bez daty nie znika. Termin wykonania i data sprawdzenia mają
różne etykiety. Odblokowanie usuwa Działanie z kolejki oczekujących.

**Ryzyko.** Dwie daty mogą być mylone. Interfejs musi objaśniać je wprost;
przypomnienia systemowe pozostają poza tą wersją.

## 3. Podpowiedzi istniejącej Wiedzy

**Problem.** Skrzynka zachowuje nowe przechwycenie, a Biblioteka pozwala
wiązać Wiedzę z Celem i Działaniem, ale użytkownik musi sam pamiętać, że
materiał już istnieje.

**Przepływ pierwszej wersji.** Podczas zapisu linku aplikacja pokazuje
istniejące Materiały o tym samym znormalizowanym adresie. Użytkownik może
otworzyć materiał, powiązać go z aktualnym Projektem/Celem/Działaniem albo
zachować nowy wpis osobno. Oryginał przechwycenia pozostaje w Skrzynce.
Na szczególe Celu lub Działania sekcja Wiedzy proponuje kilka aktywnych
materiałów z tego samego Projektu, z wyjaśnieniem źródła podpowiedzi.

**Warstwa danych.** Najpierw zastosować deterministyczne porównanie adresów
HTTP(S) i istniejące relacje. Nie scalać treści ani nie wykorzystywać AI.
Zapytania muszą być ograniczone do Workspace i respektować Archive/Trash.
Jeśli obecny odczyt nie wystarcza, dodać paginowane zapytanie repozytorium
oraz odpowiedni indeks, bez pobierania całej Biblioteki do przeglądarki.

**Kryteria odbioru.** Ten sam link daje podpowiedź; różne adresy nie są
automatycznie uznawane za duplikat. Zapis mimo podpowiedzi działa. Powiązanie
istniejącego materiału jest odwracalne i nie zmienia jego treści.

**Ryzyko.** Parametry URL i przekierowania mogą mieć znaczenie. Normalizacja
powinna być ostrożna; decyzja o połączeniu zawsze należy do użytkownika.

## 4. Ulubione widoki pracy

**Problem.** Filtry Działań działają przez URL, ale często używany zestaw
trzeba wybierać ponownie lub zachować jako zakładkę przeglądarki.

**Przepływ pierwszej wersji.** Na liście Działań można zapisać bieżący filtr
pod nazwą, otworzyć go z menu i zmienić nazwę lub usunąć. Limit pierwszej
wersji: pięć widoków na Workspace. Filtr wskazujący zarchiwizowany Cel lub
Projekt pokazuje czytelny stan i możliwość poprawienia widoku.

**Warstwa danych.** Zapisany widok przechowuje tylko nazwę i zwalidowane
parametry istniejącej listy, nie kopię Działań. Preferencja musi być dostępna
na dwóch urządzeniach, więc wymaga zgodnego zapisu demo/Supabase, migracji
addytywnej i RLS. W kolejnym kroku można rozważyć przypięcie Projektów i Celów
do menu, jeśli same filtry okażą się używane.

**Kryteria odbioru.** Widok zachowuje się po reloadzie i na drugim urządzeniu;
zmiana Działania nie wymaga aktualizacji zapisanego widoku. Usunięcie widoku
nie usuwa żadnych danych domenowych.

**Ryzyko.** Zbyt wiele skrótów zagęści nawigację. Limit i możliwość usunięcia
powinny być częścią pierwszego wydania.

## 5. Powtórki nauki — tylko po potwierdzeniu potrzeby

**Warunek rozpoczęcia.** Funkcję uruchomić, jeśli użytkownik regularnie
prowadzi Cele nauki i chce sprawdzać pamięć lub umiejętność w Command.
Jeśli nauka jest pobocznym zastosowaniem, nie budować osobnego modułu.

**Pierwsza wersja.** Z Materiału lub Celu nauki użytkownik tworzy pytanie
albo krótkie zadanie. Po próbie zapisuje odpowiedź, samoocenę i datę
ponowienia. Historia prób jest powiązana z Celem; samo wykonanie powtórki
nie oznacza osiągnięcia Celu. Bez automatycznego generowania pytań przez AI
i bez rozbudowanego algorytmu interwałów.

**Warstwa danych i odbiór.** Potrzebny jest osobny zapis niezmiennych prób,
powiązanie z Celem i Materiałem, migracja, RLS, eksport oraz adapter demo.
Test powinien wykazać, że kolejna próba dodaje wpis historyczny zamiast
nadpisywać poprzedni, a odroczenie nie zmienia wyniku Celu. Przed projektem
warto sprawdzić na kilku prawdziwych materiałach, czy użytkownik wraca do
takich prób przez co najmniej dwa tygodnie.

**Ryzyko.** Rozbudowanie Command w drugą aplikację do fiszek. Jeśli potrzeba
dotyczy tylko przypomnienia o materiale, wystarczy prostsza data powrotu.

## Kolejność realizacji i zasady odbioru

1. Najpierw domknąć [odbiór istniejących przepływów na stagingu](./priority-implementation-2026-09-08/09-staging-acceptance.md),
   żeby nowe funkcje nie przykryły niezweryfikowanego zapisu i synchronizacji.
2. Wdrożyć plan tygodnia jako jeden przepływ Review → Działania → Start,
   z zapisem decyzji i obsługą częściowego błędu.
3. Dodać datę powrotu do blokady, potem podpowiedzi Wiedzy. Obie funkcje
   korzystają z istniejących list i szczegółów.
4. Wprowadzić ulubione widoki po sprawdzeniu, które filtry są naprawdę
   powtarzane. Powtórki nauki pozostawić jako osobną decyzję produktową.

Każdy etap kończy się działającym przepływem w demo i Supabase: loading,
pusty stan, błąd, retry, undo, klawiatura i mobile; testy domeny, migracji,
RLS oraz odbiór na odseparowanym Workspace staging. Dla zmian danych zachować
eksport i zgodność starszego frontendu w trakcie wydania. Nie wdrażać
migracji ani produkcji na podstawie samego planu.

## Decyzje przed rozpoczęciem

1. Czy plan tygodnia ma być głównym rytuałem w aplikacji, czy tylko
   opcjonalnym narzędziem w Podsumowaniu? Plan zakłada opcjonalność.
2. Czy priorytetem są blokady i odzyskiwanie kontekstu, czy praca z rosnącą
   Biblioteką Wiedzy? Ta odpowiedź może zamienić kolejność etapów 2 i 3.
3. Czy nauka jest na tyle częstym zastosowaniem, by uzasadnić historię prób
   i nowy model danych? Bez potwierdzenia etap 5 pozostaje odłożony.
