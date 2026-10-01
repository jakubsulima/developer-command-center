# Podsumowanie tygodnia — plan UI/UX i funkcji, przede wszystkim mobile

Data: 2026-09-27. Status: audyt i plan; bez zmian implementacji i danych użytkownika.

Podsumowanie ma działającą podstawę: liczniki, sugestie, planowanie terminów, notatkę, historię oraz przegląd AI. Największą wartość da połączenie tych części w przepływ: **zobacz rezultaty → rozstrzygnij zaległości → wybierz kolejny kierunek → zapisz → porównaj za tydzień**. Na telefonie trzeba ograniczyć powtarzane opisy i eksponować działania. Rozbudowa funkcji powinna być dostępna przez szczegóły, a główny ekran pozostać krótki.

## Zakres i dowody

- Obejrzano działającą aplikację: Tydzień, Plan i wybór zakresu, istniejący wynik AI, pustą Historię, przejście sugestii do właściwego zablokowanego Działania i powrót.
- Kontrola mobilna: początkowy wąski widok, następnie 390×844 (zamknięcie), 360×800 (Plan i AI). Uzupełniająco Tydzień na 1440×1000. Dla AI przy 360 px szerokość dokumentu wynosiła 360 px — brak poziomego przepełnienia w tym stanie.
- Odczyt implementacji: `ReviewPage.tsx`, `WeeklyPlanPanel.tsx`, `AIGoalReview.tsx`, `weeklyReview.ts`, `weeklyPlan.ts`, `usePersistentDraft.ts`, ścieżka zapisu w store i adapterze danych, style mobilne oraz testy.
- Uruchomiono testy: `weeklyReview.test.ts`, `weeklyPlan.test.ts`, `App.regression.test.tsx`, `AIGoalReview.test.tsx`: **4 pliki, 74 testy, wszystkie zaliczone**.
- Nie zapisywano planów, ocen AI ani zamknięć na koncie. Nie uruchamiano płatnego generowania. Zapis i tworzenie Działań są potwierdzone kodem/testami lokalnymi, nie pełnym testem na bieżącym backendzie.
- Nie sprawdzono fizycznego telefonu, klawiatury ekranowej, VoiceOver/TalkBack, rzeczywistej pracy offline ani konfliktów między urządzeniami. Wymagają osobnego odbioru.

Założenie priorytetyzacji: najważniejsze są rozumienie postępów i plan kolejnego tygodnia. Użytkownik doprecyzował pierwszeństwo mobile; pozostałe preferencje nie zostały rozstrzygnięte.

## Stan funkcji

| Funkcja | Co jest teraz | Poziom weryfikacji / luka |
| --- | --- | --- |
| Tygodniowe liczniki | Ukończone Działania, dodana Wiedza, aktualizacje postępu | Widoczne w UI; reguły objęte testami. Brak wejścia z licznika do listy źródeł. |
| Sugestie | Blokady, Cele bez następnego kroku, zaległości, Skrzynka | Link do blokady sprawdzony. Domena zwraca najwyżej 3 kategorie; czwarta może zniknąć. |
| Plan | Do 3 Celów, samodzielne Działania, dzień, usunięcie terminu, nowy krok | Kod i testy. UI wyboru zakresu obejrzany; zapis na koncie niewykonywany. |
| Bezpieczeństwo zapisu terminów | Wersje rekordów, błędy per Działanie, częściowy sukces, Cofnij | Obecne w kodzie; pełne konflikty/rollback na serwerze nieweryfikowane. |
| Szkic | Lokalna notatka i plan rozdzielone według użytkownika/Workspace; plan także według tygodnia | Notatka używa stałego klucza bez tygodnia. Nowy krok w Planie ma tylko stan komponentu. |
| Zamknięcie | Podsumowanie, 3 liczniki, wybrane ID Celów, opcjonalna decyzja | Test lokalny obejmuje zapis. Brak pełnego snapshotu Działań planu i jawnego okresu w payloadzie z tego ekranu. |
| Historia | Lista zapisów, data zapisania, tekst, nazwy Celów odczytywane z aktualnego stanu, paginacja | Pusty stan obejrzany. Nazwa zmienionego Celu może zmienić prezentację wcześniejszego wpisu. |
| AI | Odczyt poprzedniego wyniku, aktualność, zakres, zalecenia, feedback, opcjonalny szkic Działania | Istniejący wynik obejrzany; generowanie/feedback bez testu na koncie. Nie każde zalecenie zawiera `draftAction`. |
| Porównanie z planem, trendy, wybór dowolnego tygodnia | Nie ma ich w badanym ekranie i jego modelu planu | Nowe funkcje wymagające danych historycznych, nie tylko nowych wykresów. |

## Najważniejsze — P0

| Zmiana | Obserwacja | Co wdrożyć | Korzyść | Zależności i ryzyka |
| --- | --- | --- | --- | --- |
| Krótszy ekran mobilny | Trzy ciasne kafle; opisy liczników mają w CSS 10 px. Zamknięcie powtarza opis i liczniki. | Czytelne krótkie etykiety: „Ukończone”, „Wiedza”, „Postęp”; większe liczby, opisy 12–14 px. Szczegółowy opis pod rozwinięciem. Jeden zwięzły podgląd zapisu. | Szybsze odczytanie wyniku i mniej przewijania. | Sprawdzić 320/360/390/430 px i długie polskie nazwy. Krótkie etykiety muszą mieć pełne nazwy dostępności. |
| Czytelne priorytety i akcje | Tydzień zawiera wyniki i sugestię, lecz droga do Planu nie jest główną akcją. | Po wynikach sekcja „Wymaga decyzji”, następnie przycisk „Zaplanuj kolejny tydzień”; zapis podsumowania jako osobna, jasno nazwana operacja. | Użytkownik wie, co zrobić po przeczytaniu. | Nie wymagać przejścia przez checklistę ani użycia AI. |
| Łatwiejszy start Planu | Wybór zakresu jest zwinięty nawet przy zerowym wyborze; pusty stan powtarza instrukcję. | Automatycznie rozwinąć wybór przy pustym planie. Wyszukiwarka Celów, grupowanie według Projektu, wybrane Cele na górze. Przycisk „Przejdź do dni”. | Mniej kroków i łatwiejsza obsługa wielu Celów. | Zachować domyślne 3 priorytety; odróżnić priorytety od wszystkich Działań zaplanowanych na tydzień. |
| Pełna kolejka spraw | `suggestions.slice(0, 3)` ukrywa czwartą kategorię; wiele Celów bez kroku prowadzi tylko do pierwszego Celu. | Jedna sugestia na wierzchu, „Zobacz wszystkie” z pełną listą i licznikami, lista wszystkich Celów bez następnego kroku. | Żaden typ problemu nie znika i można obsłużyć całą kolejkę. | Pobierać pełne/stronicowane dane; liczby nie mogą zależeć od tego, ile rekordów już załadowano. |
| Wiarygodne liczby i okres | „Sprawy” są sumą kategorii; jedno Działanie może być jednocześnie zaległe i zablokowane. Historia opisuje datę zapisu, nie jawnie okres. | Liczyć unikalne obiekty lub nazwać wynik „sygnałami” i wyjaśnić nakładanie. Oddzielić „Wyniki tego tygodnia” od „Stan na teraz”. Wprowadzić jawne daty okresu i strefę. | Użytkownik rozumie dane i ufa historii. | Uzgodnić reguły archiwizacji, ponownego otwarcia Działania, niepełnego tygodnia i historycznych zapisów. |
| Spójny zapis i ochrona szkiców | Notatka nie ma klucza tygodnia; odznaczenie Celu usuwa przypisane mu zmiany terminów; „Zapisz ponownie” tworzy kolejny lokalny rekord. | Szkic per tydzień; wykrywanie starego szkicu z możliwością przeniesienia. Zachować przygotowane terminy poza filtrem. Rozróżnić szkic, zapis terminów i zapis podsumowania. Ponowny zapis jako jawna rewizja. | Brak cichej utraty pracy i niejasnych duplikatów. | Migracja szkiców, stabilna idempotencja także po timeout, obsługa częściowego sukcesu. Nie obiecywać transakcyjności, jeśli operacje są oddzielne. |
| AI: zalecenie bliżej początku | Na 360 px przyciski, aktualność i daty zajmują niemal pierwszy ekran. | Jedna sekcja statusu i zakresu, główna akcja „Aktualizuj analizę”, wymuszenie w menu. Krótkie zalecenia z rozwijanym uzasadnieniem. | Szybsze dotarcie do użytecznej treści. | Zawsze zachować widoczny komunikat o nieaktualności. Nie mieszać 28 dni AI z tygodniem kalendarzowym. |

## Rozbudowa funkcji — P1, średni priorytet

| Funkcja | Zakres UI i działania | Dane / wymagania | Korzyść i ryzyko |
| --- | --- | --- | --- |
| Szczegóły wyników | Dotknięcie licznika otwiera listę Działań, Wiedzy lub postępów z tygodnia; filtry Projekt/Cel i powrót do tego samego miejsca. | Zapytania po tym samym okresie, strefie i regułach co agregat; paginacja, stany puste/błędy. | Liczby stają się weryfikowalne. Ryzyko rozbieżności listy i agregatu. |
| Plan kontra wykonanie | Karta „Z planu wykonano…”; osobno praca dodatkowa, przełożona i anulowana; lista z decyzją dla niewykonanych kroków. | Trwały plan z ID Działań, datami, priorytetami, wersją i historią zmian. Oddzielić plan początkowy od zmian w trakcie tygodnia. | Pozwala lepiej planować. Procent zadań nie jest miarą wartości pracy; bez planu pokazać „Brak zapisanego planu”. |
| Mobilna agenda | Lista według dni, pasek wyboru dnia, liczba Działań w dniu, „Bez terminu”, szybkie przeniesienie. Formularz nowego kroku w panelu od dołu. | Obecne `scheduledFor`, wersje i mutacje; pełne pobieranie planu; Rutyny bez duplikowania wystąpień. | Użytkownik widzi obciążenie. Liczb nie przedstawiać jako godzin, jeśli brak estymat. Nie wymagać drag-and-drop. |
| Decyzje o zaległościach | Zaznacz kilka → przełóż, pozostaw, anuluj; podgląd i Cofnij; blokady ze wskazaniem powodu i daty przeglądu. | Istniejące komendy domenowe, sprawdzanie wersji, idempotencja, wynik każdej operacji. | Mniej powtarzalnego klikania. Ryzyko masowego przenoszenia zaległości bez przemyślenia. |
| Rezultaty Celów | Karty Celów/Projektów z ukończonymi krokami, zmianą kryteriów i powiązanym dowodem lub Wiedzą. | Stabilne zdarzenia/odczyt okresowy kryteriów i relacji. Gdy brak danych, pokazać brak danych zamiast wyliczać fikcyjny procent. | Pokazuje rezultat oprócz samej aktywności. Ryzyko oceniania Celu przez liczbę drobnych zadań. |
| Historia tygodni | Selektor tygodnia, zapisane wersje, szczegóły decyzji, porównanie dwóch zapisanych tygodni; pusty stan z akcją. | Snapshot dat, metryk, nazw i ID Celów; czytnik starszych formatów. Brakujące dane historyczne oznaczyć. | Można wrócić do wcześniejszych ustaleń. Większy model danych i koszty utrzymania. |
| AI → Plan | „Dodaj do planu” dla istniejącego kroku; przy nowym szkic z edycją i wyborem dnia, bez domyślnego przypięcia do Dzisiaj. | Link do źródłowego zalecenia, sprawdzanie aktualności Celu/Działania, deduplikacja, zatwierdzenie. | Skraca drogę od sugestii do wykonania. AI nie może automatycznie zmieniać kalendarza. |
| Refleksja opcjonalna | „Co pomogło?”, „Co zmienię?” jako rozwijane podpowiedzi, najważniejsza decyzja pozostaje wystarczająca. | Pola snapshotu i szkice; zamknięcie bez refleksji nadal dostępne. | Więcej kontekstu na przyszłość. Obowiązkowe pytania zwiększyłyby ciężar cotygodniowego przeglądu. |

## Później / warunkowo — P2

| Funkcja | Warunek i kompletna realizacja | Korzyść / koszt |
| --- | --- | --- |
| Trendy 4/8/12 tygodni | Najpierw stabilne snapshoty; wykres + tabela, filtry, oznaczenie niepełnych tygodni i brakujących danych. | Wzorce regularności; ryzyko nadmiernego nacisku na liczbę Działań. |
| Eksport pojedynczego tygodnia | Markdown na start, PDF później; wybór zakresu danych i uwzględnienia notatki/AI, zgodność z zapisanym snapshotem. | Łatwe wykorzystanie poza aplikacją; ryzyko ujawnienia prywatnej treści przy późniejszym udostępnianiu. |
| Przypomnienie o przeglądzie | Dobrowolny dzień/godzina w strefie Workspace, zatrzymanie po zamknięciu, deduplikacja i łatwe wyłączenie. | Wspiera regularność; zmęczenie powiadomieniami i utrzymanie mechanizmu wysyłki. |
| Plan z poprzedniego tygodnia | Świadomy wybór niewykonanych kroków, podgląd dat i konfliktów; nigdy automatyczna kopia wszystkiego. | Szybszy start; ryzyko narastania zaległości. |
| Dostępność czasowa | Najpierw opcjonalne szacunki czasu i dostępność dni, dopiero potem sygnały przeciążenia. | Realistyczniejszy plan; dodatkowy obowiązek uzupełniania danych. |
| Personalizacja sekcji | Dopiero po obserwacji użycia; proste pokaż/ukryj, dobry zestaw domyślny. | Dopasowanie widoku; niepotrzebna konfiguracja na początku. |

## Docelowy układ telefonu

1. Kompaktowy nagłówek: tydzień, stan „Bieżący” albo „Zapisano o…”, wybór wcześniejszego tygodnia po wdrożeniu historii.
2. Zachowane cztery zakładki, bez dodawania kolejnych: Tydzień, Plan, AI, Historia. Pełna nazwa sekcji wewnątrz zakładki.
3. Tydzień: wyniki z wejściem w szczegóły → realizacja planu, jeśli istnieje → jedna pilna decyzja i „Wszystkie sprawy” → opcjonalna refleksja → przejście do Planu / zapis.
4. Plan: wybór priorytetów → agenda dni → nowy krok → zapis zmian. Zamknięcie jako zwięzły podgląd otwierany na żądanie zamiast drugiej długiej karty.
5. AI: zakres i aktualność → krótki wniosek → 1–3 zalecenia z akcją → rozwijane źródła i pozostałe oceny Celów.
6. Historia: lista tygodni i stan pusty; „Stan na teraz” przenieść do Tygodnia, gdzie jest zgodny z kontekstem.

Przyklejony pasek akcji stosować tylko tam, gdzie użytkownik edytuje plan lub decyzję. Umieścić go nad nawigacją mobilną, uwzględnić safe area i wysokość klawiatury. Nie dokładać stale kilku pasków zajmujących większość ekranu. Cele dotykowe projektować na co najmniej 44×44 px; sprawdzić fokus, kolejność odczytu i powiększenie tekstu. Stan zapisu musi rozróżniać „Szkic na tym urządzeniu”, „Zapisywanie”, „Zapisano”, „Błąd — zachowano szkic”.

## Kolejność wdrożenia i kryteria odbioru

| Etap | Zakres | Bramka odbioru |
| --- | --- | --- |
| 1. Mobile i bieżące błędy | P0: uproszczony układ, początek Planu, pełne sugestie, poprawne etykiety, ochrona szkiców i zmian terminów. | 360 px: żadnego poziomego scrolla; wszystkie akcje osiągalne dotykiem/klawiaturą; wszystkie 4 kategorie sugestii dostępne; ukrycie Celu nie kasuje przygotowanych terminów. |
| 2. Kontrakt tygodnia | Jawny okres/strefa, snapshot planu i podsumowania, wersjonowanie, stabilna idempotencja. | Ten sam tydzień na dwóch urządzeniach; ponowienie po timeout nie dubluje zapisu; zmiana nazwy/usunięcie Celu nie zmienia starego snapshotu; starsze zapisy nadal czytelne. |
| 3. Wyniki i wykonanie | Szczegóły metryk, rezultaty Celów, porównanie planu i wykonania. | Suma wyników list zgodna z licznikiem przy paginacji; praca dodatkowa oddzielna; brak planu i danych nie jest 0% skuteczności. |
| 4. Plan w codziennym użyciu | Agenda, decyzje zbiorcze, zapis nowego kroku ze szkicem i datą. | Błąd jednego zapisu nie oznacza sukcesu całości; retry dotyczy pozostałych; Cofnij sprawdza wersje; blocked nie dostaje terminu bez rozstrzygnięcia blokady. |
| 5. Historia i AI → Plan | Wybór tygodnia, rewizje, zatwierdzane kroki AI. | Zakres AI odróżniony od tygodnia; nieaktualne zalecenie weryfikowane przed zapisem; brak duplikatów po ponowieniu. |
| 6. Rozszerzenia | Trendy, eksport, opcjonalne przypomnienia. | Najpierw wiarygodne dane i obserwacja wykorzystania wcześniejszych funkcji. |

Zmiany danych wymagają nowej wersji kontraktu, migracji addytywnej i zgodności ze starszymi zapisami. Listy i agregaty muszą mieć identyczne reguły Workspace, widoczności, okresu oraz strefy. Nie budować historycznych statystyk wyłącznie z bieżącego, częściowo załadowanego `AppState`. Najpierw model danych i testy izolacji, potem interfejs, na końcu kontrolowany rollout.

Testy przekrojowe: pusty Workspace, brak planu, dużo Celów i bardzo długie nazwy, wszystkie kategorie problemów, tydzień na przełomie roku, zmiana czasu i strefy, niedziela→poniedziałek przy otwartej stronie, zamknięcie przed końcem tygodnia, dwa zapisy równocześnie, przerwana sieć, konflikt wersji, rekord usunięty po utworzeniu szkicu, wygasła sesja. Mobile: 320/360/390/430 px, powiększenie tekstu, VoiceOver/TalkBack i fizyczna klawiatura ekranowa. Testy lokalne nie zastępują odbioru rzeczywistego zapisu i synchronizacji.

## Decyzje do potwierdzenia przed odpowiednim etapem

1. **Semantyka zamknięcia:** rekomendacja — zapis migawki i kolejnych jawnych rewizji, bez blokowania dalszej pracy w tygodniu. W UI warto użyć „Zapisz podsumowanie”, skoro tydzień nadal trwa.
2. **Zakres Planu:** rekomendacja — do 3 priorytetowych Celów, ale podgląd wszystkich Działań już zaplanowanych na dany tydzień. Limit priorytetów nie powinien ukrywać reszty kalendarza.
3. **AI:** rekomendacja — zachować osobny ruchomy horyzont 7/14/28 dni; analiza dokładnie wskazanego tygodnia to późniejszy, oddzielny tryb.

Te decyzje nie blokują poprawek czytelności, pełnej listy sugestii i ochrony szkiców.

## Powiązanie z wcześniejszym planem

Plan z `2026-09-25-weekly-review-improvements-handoff.md` częściowo opisuje funkcje już obecne: osobną zakładkę AI, ustawienia, aktualność i podgląd zamknięcia. Nie należy ponownie traktować ich jako brakujących. Niniejszy audyt rozszerza zakres o mobile, plan kontra wykonanie i historię; nie poświadcza ukończenia wszystkich wcześniejszych wymagań serwerowych ani wdrożenia migracji.
