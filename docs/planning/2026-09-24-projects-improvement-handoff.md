# Projekty: plan poprawy drogi od listy do działania

**Data:** 24 września 2026  
**Status:** plan do przekazania wykonawcy; bez zmian funkcjonalnych w tej pracy  
**Priorytet produktu:** szybszy powrót do konkretnego kroku przy zachowaniu Projektu jako trwałego kontekstu.

## Kontekst i granice

Projekt jest trwałym kontenerem Celów, Działań i Wiedzy, a nie rezultatem do ukończenia. Zachowaj decyzje z [hierarchii produktu](./project-centered-hierarchy.md) i język z `CONTEXT.md`. Lista `/projects` ma dziś filtr kategorii, grupowanie, archiwum i Kosz; szczegół ma zakładki Przegląd, Cele, Działania i Wiedza. W działającym widoku mobilnym jest pięć aktywnych Projektów.

Kod źródłowy: `apps/web/src/pages/ProjectsPage.tsx`, `apps/web/src/pages/ProjectDetailPage.tsx`, `apps/web/src/domain/projectModule.ts`, `apps/web/src/domain/homeSummary.ts`, `apps/web/src/styles.css`. Testy przepływów są w `apps/web/src/app/App.test.tsx` i `NavigationExperience.test.tsx`.

W repozytorium są już niezapisane zmiany użytkownika, także w `ProjectDetailPage.tsx`, `styles.css`, testach i planie tygodnia. Przed implementacją sprawdź bieżący diff; nie cofaj i nie nadpisuj tych zmian. Ten plan nie wymaga zmiany schematu ani Supabase dla etapów 1–3.

## Kolejność i zakres

| Etap | Zmiana | Rezultat użytkownika | Zależność |
| --- | --- | --- | --- |
| 1 | Skrócenie ścieżki z Przeglądu | „Dodaj Działanie” otwiera formularz, a wskazane Działanie otwiera swój szczegół | Obecne modale, `NavigationLink` i ścieżka kontekstu |
| 2 | Wiarygodny „Najbliższy ruch” | Przegląd pokazuje właściwy sygnał, z opisem blokady lub terminu | Czysta funkcja wybierająca sygnał Projektu |
| 3 | Czytelniejsza lista mobilna | Widać więcej Projektów i jeden ważny sygnał na karcie | Wynik funkcji z etapu 2 |
| 4, warunkowo | Sortowanie i przypięcie | Szybszy dostęp, gdy liczba Projektów wzrośnie | Decyzja po użyciu etapów 1–3 |

Etapy 1–3 tworzą pierwszy zakres wdrożenia. Etap 4 ma osobną bramkę decyzyjną i nie powinien opóźniać pierwszego zakresu.

## Etap 1 — działające wejścia z Przeglądu

1. W `ProjectDetailPage.tsx` przy stanie „są bieżące Cele, brak otwartych Działań” przycisk **Dodaj Działanie** ma otwierać istniejący dialog tworzenia Działania z przypisanym Projektem. Nie może kończyć się na pustej zakładce. Zachowaj możliwość wskazania Celu w formularzu.
2. Gdy wskazane jest konkretne Działanie, główny przycisk karty „Najbliższy ruch” ma prowadzić do `/actions/:id` przez istniejące `routeForEntity` i `NavigationLink`, z kontekstem powrotu do Przeglądu Projektu. Osobna karta „Działania” nadal prowadzi do pełnej listy.
3. Gdy Projekt nie ma bieżącego Celu, obecna ścieżka do Celów może pozostać; etykieta przycisku musi odpowiadać temu, co otwiera. Nie twórz automatycznie Celu ani Działania.

**Odbiór:** kliknięcie „Dodaj Działanie” pokazuje dialog bez drugiego kliknięcia; zapis tworzy Działanie w poprawnym Projekcie i po odświeżeniu jest ono widoczne. Kliknięcie wskazanego Działania otwiera jego szczegół, a powrót zachowuje Projekt. Anulowanie dialogu nie zapisuje danych.

## Etap 2 — jeden spójny sygnał Projektu

Wyodrębnij czystą funkcję domenową, np. w `projectModule.ts`, która dla Projektu, stanu i bieżącej daty w strefie Workspace zwraca typowany sygnał: rodzaj, identyfikator Działania (jeśli jest), tytuł, krótki opis i liczniki. Użyj `localDateForTimeZone`, `isVisibleWorkspaceAction`, `isOpenAction` i istniejącej logiki Startu jako punktu odniesienia. Nie opieraj wyboru na kolejności tablicy `state.actions`.

Proponowana jawna kolejność:

1. Zablokowane Działanie → „Do odblokowania”, z powodem i linkiem do szczegółu.
2. Zaległe, otwarte Działanie → „Wymaga decyzji”, z datą; blokady nie liczą się drugi raz jako zaległe.
3. Działanie na dziś lub przypięte na dziś → „Na dziś”.
4. Gotowe albo w toku Działanie oznaczone `isNext` → „Następny krok”.
5. Inne gotowe albo w toku Działanie → „Możesz zrobić teraz”.
6. Jeśli są wyłącznie przyszłe lub oczekujące Działania, pokaż ich rzeczywisty stan i datę zamiast sugerować pracę „teraz”. Jeśli brak otwartych Działań, pokaż drogę do utworzenia kroku lub pierwszego Celu.

W obrębie jednego poziomu wybieraj deterministycznie po terminie, pozycji i ID. Wymagaj aktywnego Projektu; dla Działania powiązanego przez Cel uwzględniaj tylko widoczny Cel z tego Projektu. Nie pokazuj ukończonych, pominiętych, anulowanych ani ukrytych relacji jako bieżącego ruchu. Stan `testing` wymaga czytelnej etykiety „Do sprawdzenia” i nie może być opisany jako „Do zrobienia”.

Przegląd i lista Projektów mają korzystać z tej samej projekcji. Wartość `isNext` pozostaje wyborem na poziomie Celu; nie dodawaj nowej flagi „główny Projekt”. Dla wielu kandydatów wynik ma być stabilny po odświeżeniu i przy innej kolejności rekordów. Przed kodowaniem upewnij się, że reguły nie kłócą się z wdrażanym równolegle planem tygodnia i datą ponownego sprawdzenia blokady.

**Odbiór:** testy jednostkowe obejmują blokadę, zaległość, dziś, `isNext`, przyszłą datę, dwa kandydaty tego samego rodzaju, Cel archiwalny i brak Działań. Test widoku potwierdza zgodność tekstu, celu linku i stanu pustego. Zmiana statusu Działania odświeża sygnał bez ręcznego reloadu.

## Etap 3 — lista, którą łatwo przeskanować na telefonie

W `ProjectsPage.tsx` pokaż na aktywnej karcie **najwyżej jeden** sygnał z etapu 2, np. „1 zablokowane”, „2 zaległe” lub „Brak następnego kroku”. Nie zastępuj nim liczb Celów i Działań; jest wskazówką, który Projekt otworzyć. Dla kart w Archiwum i Koszu nie pokazuj bieżących sygnałów ani mylącego „Aktywny”.

Skróć ogólny wstęp nad listą. Na mobile ogranicz wysokość kart w `styles.css`: nie rezerwuj miejsca na opis, którego użytkownik nie podał; opis wprowadź w najwyżej dwóch wierszach, a pełną treść zostaw w szczególe. Usuń zastępcze zdanie wyglądające jak zapisany opis lub pokaż wyraźne „Bez opisu”. Zachowaj dostateczny obszar dotyku dla „Otwórz projekt”, czytelność nazw, widoczny fokus klawiatury i obecne kategorie.

**Odbiór:** na szerokości około 360 px lista jest wyraźnie krótsza bez ucinania nazwy lub przycisku; przy długim opisie i wielu kategoriach karta nie wychodzi poza ekran. Sygnały wynikają z tych samych rekordów co Przegląd, aktualizują się po zmianie statusu i nie podwajają jednego Działania pośrednio z Celu i bezpośrednio z Projektu. Pusty filtr, Archiwum i Kosz pozostają używalne.

## Etap 4 — dopiero gdy liczba Projektów utrudnia wybór

Najpierw sprawdź, czy po etapach 1–3 użytkownik rzeczywiście szuka Projektu częściej niż kilka razy dziennie lub ma około dziesięciu aktywnych Projektów. Jeśli tak, dodaj prosty wybór kolejności: alfabetycznie (domyślnie) lub „wymagające uwagi”. Zachowaj filtr kategorii i grupowanie; grupowany widok może sortować wewnątrz grup. Parametr URL wystarczy do zachowania wybranego widoku podczas powrotu i odświeżenia. Nie dodawaj trwałej preferencji dla samego sortowania, jeśli nie jest potrzebna na wielu urządzeniach.

Przypięcie Projektów jest osobną decyzją. Jeśli będzie potrzebne, zapisz je w Workspace i obsłuż w demo oraz Supabase, z addytywną migracją, RLS, eksportem i testem synchronizacji między urządzeniami. Nie używaj lokalnego `localStorage` jako jedynego źródła tej preferencji.

## Weryfikacja i ograniczenia wykonania

- Dodaj tylko testy sprawdzające zachowanie: czysta funkcja sygnałów, dwa główne kliknięcia z Przeglądu i regresja listy. Nie pisz testów odzwierciedlających wyłącznie klasy CSS.
- Uruchom `pnpm lint`, `pnpm typecheck`, `pnpm test` i `pnpm build`. Obejrzyj `/projects` i `/projects/:id` na mobile i desktopie oraz sprawdź klawiaturę.
- Pierwszy zakres korzysta z istniejących danych i nawigacji; nie wymaga nowej tabeli, endpointu, AI ani migracji. Nie zmieniaj semantyki archiwizacji i Kosza.
- Nie wdrażaj na produkcję, nie wypychaj zmian i nie twórz commita bez osobnego polecenia. Raportuj, które etapy ukończono, jakie testy przeszły i co zostało warunkowe.

## Gotowe polecenie dla Luny

> Wdróż etapy 1–3 planu `docs/planning/2026-09-24-projects-improvement-handoff.md`. Najpierw sprawdź aktualny stan i istniejący diff, bo w repozytorium są moje niezapisane zmiany. Zachowaj model trwałego Projektu oraz aktualne prace nad planem tygodnia i blokadami. Implementuj małymi krokami, zweryfikuj wskazane scenariusze i uruchom lint, typecheck, testy oraz build. Nie wdrażaj etapu 4, migracji ani produkcji. Na koniec opisz wykonane zmiany, wyniki sprawdzenia i ewentualne ryzyka.
