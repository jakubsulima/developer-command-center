# Plan poprawy mobilnego UI i UX

Data: 30 września 2026. Status: wdrożono w kodzie; odbiór na urządzeniach pozostaje otwarty.

Celem jest prostsze i wygodniejsze codzienne korzystanie z aplikacji na telefonie. Nowy wygląd i animacje mają pomóc szybko znaleźć następny krok, zapisać myśl, ukończyć Działanie i wrócić do właściwego miejsca. Rekomenduję zachowanie ciemnego motywu i obecnego języka produktu, zwiększenie czytelności, uproszczenie powtarzalnych interakcji oraz wspólny system ruchu.

## Status realizacji

Etapy 1–5 wdrożono w repozytorium w zakresie opisanym w [raporcie implementacji](./2026-09-30-mobile-ui-ux-implementation-report.md). Etap 6 obejmuje lokalną weryfikację aplikacji demo, testy, build i dokumentację. Do pełnego odbioru pozostały rzeczywiste urządzenia iOS/Android, instalacja PWA, czytniki ekranu oraz testy z klawiaturą mobilną.

Plan obejmuje Start, Projekty, Cele, Działania, Wiedzę i Skrzynkę, Czytelnię, Rutyny, Podsumowanie, AI, wyszukiwanie, formularze, logowanie i Ustawienia. Pierwsze wydanie powinno poprawić całą codzienną pętlę: Start → Działanie → ukończenie → powrót oraz Dodaj → zapis → potwierdzenie. Następne wydanie przenosi te same wzorce do pozostałych modułów.

## Stan przed wdrożeniem: ustalenia i zakres audytu

Użytkownik wskazał **prostotę i wygodę codziennego korzystania** jako najważniejszy cel. Kierunek wizualny i parametry animacji poniżej są rekomendacją projektową, a nie zaakceptowaną makietą ani wynikiem testów użyteczności.

| Obszar | Co sprawdzono | Granica pewności |
| --- | --- | --- |
| Działająca aplikacja | Lokalne demo: Start, lista i szczegół Projektu, lista i szczegół Działania, szczegół Celu, kontekstowe Dodaj, Więcej, Biblioteka, Skrzynka, Tydzień i otwarcie wyszukiwania. | Odczyt i nawigacja; bez wykonywania zapisu, ukończenia, AI ani zmian danych. |
| Telefon | Powyższe widoki przy 390×844. Tydzień oraz otwarcie wyszukiwania dodatkowo przy 320×740. | Rozmiar okna przeglądarki; bez fizycznej klawiatury telefonu, PWA i gestów systemowych. |
| Mały ekran | Tydzień: szerokość dokumentu 320 px, brak elementów wychodzących poza ekran w odczycie geometrii. Etykieta „Ukończone” wizualnie nie mieści się w kafelku metryki. | Brak poziomego przewijania nie dowodzi czytelności zawartości kafelków. |
| Uruchomienie | Demo ładuje treść, nawigacja działa, nie zaobserwowano nakładki błędu Vite. Odczyt konsoli na początku i na końcu nie zwrócił ostrzeżeń ani błędów. | Nie jest to pełna kontrola działania wszystkich tras. `agent-browser` nie był dostępny; użyto przeglądarki Codex. |
| Kod | Shell, routing, strony, wspólne kontrolki Działań, Modal, FormTransition, feedback, tokeny i CSS; wcześniejsze plany. | Rutyny, lista Celów, szczegół Wiedzy/Czytelnia, AI i logowanie nie zostały przećwiczone w tym audycie. |
| Zapis i dostępność | W kodzie istnieją szkice, undo, obsługa visualViewport, fokus dialogów, safe area, cele dotykowe i reduced motion. | Poprawność zapisu na produkcji, kontrast wszystkich komponentów, czytniki oraz realne urządzenia pozostają do odbioru. |

W drzewie roboczym są wcześniejsze zmiany m.in. Podsumowania, Planu, AI, szkiców i CSS. Ten dokument opisuje aktualnie odczytany stan. Przed implementacją trzeba sprawdzić różnicę względem planu; starsze wpisy „nierozpoczęte” w indeksie dokumentacji nie są dowodem braku funkcji.

## Problemy widoczne przed wdrożeniem

| Obserwacja | Skutek dla użytkownika | Wniosek do planu |
| --- | --- | --- |
| Start, lista Działań i następny krok Celu pokazują przede wszystkim menu statusu. Szczegół Działania ma osobny przycisk ukończenia. | Najczęstsza czynność ma różny przebieg zależnie od ekranu. | Jedno bezpośrednie ukończenie, pozostałe statusy w menu; zachować reguły domeny i cofanie. |
| Pasek statusów Działań pokazuje początek długiej listy; kolejne statusy są poza pierwszym widocznym fragmentem. | Trzeba odkryć przewijanie albo szukać rzadkiego widoku. | Krótki zestaw codziennych widoków i jawne „Filtry” z liczbą aktywnych ustawień. |
| Projekt zaczyna przegląd od nagłówków i objaśnienia przed kartą najbliższego ruchu. Start ma dużą kartę decyzji nad „Na dziś”. | Dużo wysokości jest zużyte przed właściwą listą. | Skrócić opisy, a ciężar wizualny dopasować do pilności i częstotliwości pracy. |
| Karty Projektów, filtry Wiedzy i metadane mają bardzo mały tekst. W Podsumowaniu 320 px etykieta metryki jest zbyt szeroka dla kafelka. | Interfejs jest zwarty, ale trudniejszy do szybkiego odczytu. | Większa typografia pomocnicza i układ zależny od dostępnego miejsca. |
| Biblioteka zajmuje dużą część góry ekranu zakładkami, wyszukiwaniem i siatką rodzajów; „Rezultat” wpada do osobnego rzędu. | Mniej miejsca zostaje na samą Wiedzę. | Jeden zwięzły pasek filtrów i wybór pełnego zestawu rodzajów w panelu. |
| Skrzynka pokazuje duży przycisk „Przetwórz” i osobny rząd ikon dla każdego wpisu. | Powtarzalne kontrolki zwiększają długość listy; znaczenie ikon wymaga znajomości aplikacji. | Kompaktowy wiersz i nazwane akcje w panelu wpisu. |
| „Więcej” łączy profil, stan synchronizacji, powtórzone szybkie narzędzia, moduły i akcje konta. | Menu wymaga skanowania wielu bloków przed wyborem miejsca pracy. | Moduły pracy na początku; dane i konto w dalszej części. |
| Dodaj jest pełnoekranowym formularzem, wyszukiwanie ma mały panel, a Więcej rozbudowany panel od dołu. Są lokalne animacje o różnych czasach. | Każdy rodzaj nakładki zachowuje się nieco inaczej. | Zdefiniować spójne rodziny paneli, zachować pełny ekran dla pisania i wspólne czasy ruchu. |
| `styles.css` ma ponad 5100 linii, wiele kolejnych reguł i nadpisań mobilnych. Są tokeny, ale także surowe kolory w komponentowych stylach. | Zmiana jednego widoku może niespodziewanie zmienić inny. | Porządkować style wraz z migracją komponentów, z porównaniem przed i po każdym etapie. |

## Kierunek wyglądu

Docelowy interfejs powinien być spokojny, czytelny i wygodny pod kciukiem. Zachować Geist i Lucide. Ciemny granat pozostaje tłem; niebieski oznacza główną akcję i aktywny wybór. Kolory statusów mają wyjaśniać stan wraz z tekstem. Gradient można zostawić dla pojedynczego najważniejszego elementu, a zwykłe listy oprzeć na równych powierzchniach i separatorach.

| Element | Proponowany standard |
| --- | --- |
| Typografia | Treść 15–16 px, tytuł wiersza 16 px, ważne metadane i etykiety 13–14 px, nagłówki sekcji 18–20 px, tytuł strony 24–28 px. Pola formularza co najmniej 16 px. Nie wymuszać jednej linii kosztem czytelności. |
| Odstępy | Skala 4/8/12/16/24/32 px. Margines strony zwykle 16 px; sekcje oddzielone 24 px. Wiersze mogą rosnąć przy długiej treści i większym tekście. |
| Powierzchnie | Trzy poziomy: tło, sekcja, nakładka. Unikać kilku kart z obramowaniem jedna w drugiej; zagnieżdżenie pokazywać odstępem lub separatorem. |
| Kontrolki | Główne działania wysokości 48 px; aktywny obszar ikon minimum 44×44 CSS px. Ikony zwykle 18–20 px, bez zwiększania samego rysunku do rozmiaru obszaru dotyku. |
| Karty i listy | Nazwa → kontekst Projektu/Celu → termin lub najważniejszy sygnał. Nie powtarzać tego samego kontekstu w kilku badge’ach. Pełny tytuł dostępny w szczególe. |
| Główna akcja | Jedna dominująca akcja w danym bloku decyzyjnym; pozostałe jako spokojne kontrolki. Nie powielać pełnych przycisków dodawania, jeśli pasek „Dodaj” obsługuje ten sam kontekst. |
| Nawigacja | Zachować Start / Projekty / Dodaj / Działania / Więcej w pierwszym wydaniu. Pokazać dokładną nazwę otwartego modułu i prosty powrót w szczegółach. |
| Układ mobilny | Kompaktowy nagłówek, jednoznaczny wybór widoku, treść, kontekstowa akcja. Sticky pasek tylko podczas edycji i tylko jeden nad dolną nawigacją. W formularzu pełnoekranowym własna stopka. |

44×44 px to cel projektu dla wygody obsługi. WCAG 2.2 AA określa minimum 24×24 CSS px z wyjątkami; nie należy przedstawiać projektowego celu 44 px jako wymogu tego kryterium. [W3C o rozmiarze celu](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

## Najważniejsze poprawki

| Priorytet | Zmiana i zakres | Co istnieje teraz | Co jest potrzebne | Korzyść i ryzyko |
| --- | --- | --- | --- | --- |
| P0 | Wspólny fundament: typografia, odstępy, powierzchnie, przyciski, aktywne stany. | Tokeny, komponenty UI i wiele lokalnych nadpisań. | Makiety reprezentatywnych ekranów; wspólne tokeny; migracja używanych komponentów; pomiar kontrastu. | Czytelność i spójność wszystkich modułów. Większy tekst może wydłużyć listy, dlatego potrzebne jest uproszczenie treści. |
| P0 | Ukończenie Działania z listy, Startu i Celu jednym dotknięciem, z widocznym Cofnij. | Kontrolki ukończenia i feedback istnieją; w obserwowanych listach dominuje wybór statusu. | Wspólna prezentacja i komenda; blokada ponowienia; rollback i obsługa błędu; zachowanie checklist i wymaganych decyzji, jeśli dana operacja ich potrzebuje. | Skrócenie codziennej czynności. Ryzyko przypadkowego ukończenia ograniczyć etykietą, odstępem i odwracalnością. |
| P0 | Start z „Na dziś” jako głównym miejscem pracy i krótką sekcją wymagającą decyzji. | Rekomendacja, dzienna lista, AI i rozwijane sygnały. | Dwa warianty makiety: zwykły dzień i pilna decyzja; ograniczenie objaśnień; zachowanie wejść do wszystkich spraw. | Szybsze wejście do pracy. Uproszczenie nie może ukryć rzeczywiście pilnej blokady. |
| P0 | Dodaj i edycja: jedno wymagane pole na początek, kontekst jako edytowalne podsumowanie, opcje na żądanie. | QuickAdd, formularz Wiedzy, szkice i dopasowanie do klawiatury już istnieją. | Ujednolicenie wejść i etykiet; opcjonalny opis rozwijany przy prostym Działaniu; dostępny zapis; ochrona szkicu i konfliktów. | Mniej pól do przejrzenia. Ukryte opcje muszą pozostać łatwe do znalezienia. |
| P0 | Działania: codzienne widoki, czytelne filtry, wspólny wiersz. | Długi pasek statusów, filtry, grupowanie i stan URL. | Domyślnie Otwarte / Na dziś / Zaległe; reszta statusów w nazwanym panelu; licznik filtrów; kontrola zgodności zapytania i paginacji. | Mniej decyzji przed listą. Rozdzielenie statusu i terminu musi zachować obecną semantykę oraz stare linki. |
| P0 | Nawigacja i powrót: kontekstowy „Wróć”, przywrócenie listy, krótsze Więcej. | Breadcrumbs, restoration i menu mobilne są obecne. | Kompaktowa prezentacja istniejących ścieżek; zachowanie filtrów i scrolla; moduły przed profilem; test systemowego Wstecz. | Mniej odzyskiwania kontekstu. Nie doprowadzić do różnych zachowań Wstecz i przycisku w UI. |
| P0 | Wspólne potwierdzenia, błędy i ładowanie bez skoków ekranu. | Feedback, retry i szkice; ogólny fallback ładowania trasy. | Jasne stany lokalnego szkicu i zapisu; placeholdery dopasowane do treści; stabilny shell podczas zmiany widoku; komunikaty ponad paskami. | Większa pewność zapisu i płynność. Komunikat sukcesu tylko po potwierdzonym wyniku operacji. |
| P0 | Kontrakt animacji i nakładek. | CSS, FormTransition i cykl otwarcia/zamknięcia Modal; reduced motion już jest. | Wspólne czasy i easing; wejście i wyjście; sprawdzenie CSS oraz Web Animations API; kontrola fokusu i szybkich powtórzeń. | UI łatwiejszy do śledzenia. Ruch nie może opóźniać obsługi ani psuć klawiatury. |

## Poprawki o średnim priorytecie

| Priorytet | Zmiana i zakres | Co istnieje teraz | Co jest potrzebne | Korzyść i ryzyko |
| --- | --- | --- | --- | --- |
| P1 | Projekt i Cel: najbliższy krok, czytelny wynik, szczegóły rozwijane. | Przegląd Projektu i kompaktowy szczegół Celu; część sekcji jest już zwijana. | Skrócenie nagłówków, wspólny wiersz Działania, zapis postępu dostępny blisko następnego kroku, pełne relacje w szczegółach. | Szybsza orientacja bez utraty kontekstu. Nie schować kryteriów sukcesu za zbyt wieloma wejściami. |
| P1 | Biblioteka i Czytelnia: treść przed konfiguracją. | Wyszukiwanie, rodzaje, filtry; książki i notatki obecne w kodzie. | Krótki pasek aktywnego rodzaju + Filtry; czytelne wiersze; detal Wiedzy z treścią na początku; książka z Czytam / Przeczytane i Dodaj notatkę. | Więcej materiałów widocznych od razu. Nie połączyć statusu czytania z archiwizacją. |
| P1 | Skrzynka: jeden czytelny wpis i szybka decyzja. | Przetwórz, AI, odłożenie i odrzucenie przy każdej pozycji. | Kliknięcie wpisu otwiera panel z treścią; jedna główna decyzja i nazwane pozostałe opcje; zachowanie oryginału oraz retry. | Krótsza lista i zrozumiałe opcje. Dodatkowe wejście do panelu porównać ze skróconą wersją inline. |
| P1 | Podsumowanie i AI: wyniki → decyzja → plan → zapis. | Lokalne zmiany już upraszczają widoki; osobny plan z 27 września. | Dokończyć i sprawdzić istniejące prace; usunąć obcinanie etykiet przy 320 px; ograniczyć zagnieżdżone karty; skrócić podsumowanie AI i zachować źródła na żądanie. | Czytelniejszy cotygodniowy rytuał. Zmiany prezentacji nie mogą zmienić zakresu ani historycznych danych. |
| P1 | Rutyny: najbliższe wystąpienie i prosta edycja serii. | Lista, formularz oraz mobilne szczegóły w kodzie. | Wspólne wiersze i sekcje; jasne „to Działanie” / „cała Rutyna”; czytelne dni i strefa w edycji. | Mniej niepewności przy zmianie terminu. Trzeba chronić przed przypadkową zmianą całej serii. |
| P1 | Wyszukiwanie, logowanie, Ustawienia i pierwsze użycie. | Wyszukiwanie mobilne, AuthPage, SettingsPage, first flow. | Nazwany moduł i kontekst w wynikach; stany pusty/błąd; krótki onboarding; proste grupy ustawień; formularz logowania po otwarciu klawiatury. | Spójny początek i obsługa rzadszych czynności. Nie pokazywać zaawansowanej konfiguracji jako kroku obowiązkowego. |

## Późniejsze zmiany warunkowe

| Zmiana | Warunek rozpoczęcia | Koszt lub ograniczenie |
| --- | --- | --- |
| Motyw jasny | Gdy użytkownik potwierdzi potrzebę używania aplikacji w słońcu lub preferencję jasnego UI; najpierw zakończyć tokeny kolorów. | Podwójny odbiór kontrastu i stanów w każdym widoku. |
| Gest przesunięcia do ukończenia albo odłożenia | Dopiero po odbiorze bezpośrednich przycisków; zawsze zachować widoczną alternatywę. | Konflikty z przewijaniem, systemowym Wstecz i trudniejsze odkrywanie funkcji. |
| Personalizacja dolnej nawigacji | Gdy codzienne użycie pokaże, że Wiedza lub Cele są częściej otwierane niż obecne pozycje. | Więcej konfiguracji i wariantów do utrzymania. |

## Specyfikacja animacji

Poniższe czasy są wartościami startowymi do oceny na telefonie. Używać istniejącego CSS i Web Animations API; dodatkową bibliotekę uzasadnić dopiero potrzebą, której te mechanizmy nie obsługują wygodnie. Ruch ma pokazywać reakcję, zmianę miejsca albo wynik operacji.

| Interakcja | Docelowe zachowanie | Czas startowy | Warunki |
| --- | --- | --- | --- |
| Dotknięcie przycisku | Zmiana koloru; subtelna skala około 0,98 dla głównej akcji. | 80–120 ms | Bez przesuwania sąsiednich elementów; reakcja niezależna od czasu sieci. |
| Panel opcji od dołu | Przesunięcie 12–20 px i wzrost opacity; backdrop pojawia się jednocześnie. | Wejście 220–260 ms, wyjście 160–200 ms | Stabilne blokowanie tła i powrót fokusu; pełnoekranowa edycja ma ten sam rytm. |
| Zmiana zakładki | Dyskretna zmiana aktywnego segmentu; krótki fade treści. | 140–180 ms | Stare i nowe treści nie tworzą dwóch aktywnych zestawów kontrolek. Bez przelotu całej strony. |
| Zmiana pól formularza | Zachować istniejący FormTransition: opacity i maksymalnie 6 px przesunięcia. | 180–200 ms | Nie remountować aktualnie edytowanego pola, nie gubić fokusu ani szkicu. |
| Ukończenie Działania | Natychmiastowa odpowiedź kontrolki; po potwierdzeniu stan ukończenia i spokojne usunięcie z otwartego widoku. | 160–220 ms | Busy podczas zapisu, rollback przy błędzie, Cofnij; nie animować sukcesu przed potwierdzeniem. |
| Powiadomienie | Fade i przesunięcie do 8 px; miejsce powyżej nawigacji lub stopki formularza. | 160–200 ms | Cofnij i retry dostępne; błędy nie znikają w sposób uniemożliwiający reakcję. |
| Ładowanie treści | Skeleton o zbliżonych wymiarach; delikatna zmiana opacity. | Bez obowiązkowej animacji | Przy krótkim odczycie nie wymuszać pokazania loadera; zachować poprzednie dane podczas odświeżania. |
| Rozwijanie sekcji | Chevron i łagodna zmiana widoczności treści. | 160–200 ms | Przy długiej treści zaakceptować zwykły reflow; nie animować wysokości całej strony. |

Zaproponowany easing wejścia: `cubic-bezier(.2,.8,.2,1)`, wyjścia: `cubic-bezier(.4,0,1,1)`. Dodać tokeny czasu i krzywych zamiast kolejnych lokalnych liczb. Sprawdzić przerwanie animacji, wielokrotne dotknięcie i zmianę trasy podczas zamykania panelu.

Preferować `transform` i `opacity` dla ruchu, aby ograniczyć koszt zmiany układu. Sprawdzić płynność profilerem; nie traktować samego wyboru właściwości CSS jako dowodu wydajności. [web.dev o wydajności animacji](https://web.dev/articles/animations-and-performance).

Przy `prefers-reduced-motion: reduce` usuwać przesunięcia, skalowanie, pulsowanie i niepotrzebne animacje; stan, wynik i fokus muszą pozostać czytelne. Skontrolować także animacje uruchamiane w JavaScript i nowe reguły dopisane po globalnym bloku reduced motion. [W3C o ograniczaniu ruchu](https://www.w3.org/WAI/WCAG22/Techniques/css/C39).

## Kolejność wdrożenia

| Etap | Zakres i zależności | Wynik etapu | Odbiór |
| --- | --- | --- | --- |
| 1 | Makiety Startu, Działań, szczegółu i Dodaj na 390 px; wersje 320 px; tokeny i zasady nakładek. | Jeden wzorzec wyglądu, typografii, wiersza, formularza i ruchu. | Porównanie przed/po z tymi samymi danymi. Decyzje z końca dokumentu zapisane przy makietach. |
| 2 | Shell, Więcej, powrót, wspólne kontrolki, dialogi, tokeny ruchu i stany ładowania. Wymaga etapu 1. | Wspólna podstawa wszystkich tras. | Fokus, Wstecz, scroll, safe area, reduced motion; brak nakładających się pasków i utraty szkiców. |
| 3 | Start, Działania, szczegół Działania, następny krok Celu i Dodaj. Wymaga wspólnego wiersza i feedbacku. | Pierwsze wydanie poprawiające całą codzienną pętlę. | Ukończenie i cofnięcie, błąd i retry, zapis z klawiaturą, powrót do listy z filtrem. |
| 4 | Projekty, Cele, Biblioteka, szczegół Wiedzy, Czytelnia i Skrzynka. | Wspólne wzorce w pracy z kontekstem i treścią. | Długie nazwy, dużo relacji, filtry i paginacja, notatka bez tytułu, notatka przy książce, przetwarzanie wpisu bez utraty oryginału. |
| 5 | Rutyny, Podsumowanie/Plan/AI/Historia, wyszukiwanie, logowanie i Ustawienia. Uwzględnić wcześniejsze zmiany. | Spójność całego produktu na telefonie. | Wszystkie moduły mają stan pusty, loading, błąd i sukces; małe etykiety mieszczą się; seria i pojedyncze wystąpienie są odróżnialne. |
| 6 | Odbiór na urządzeniach, porównanie codziennych czynności, domknięcie dokumentacji. | Gotowe wydanie z raportem i listą pozostałych ograniczeń. | iOS Safari/PWA, Android Chrome/PWA, czytniki i desktop. Udane lokalne testy nie zastępują odbioru rzeczywistego zapisu. |

Nie szacować teraz całego redesignu w dniach: najpierw makiety i próbna migracja wspólnego wiersza ujawnią zakres prac w CSS. Etapy 1–3 są pierwszym przyrostem; etapy 4–5 mogą być dostarczane modułami po utrwaleniu wspólnych komponentów.

## Mapa zmian w repozytorium

| Obszar | Główne miejsca | Uwagi wykonawcze |
| --- | --- | --- |
| Fundament i shell | `apps/web/src/styles.css`, `components/ui-variants.ts`, `components/ui/`, `components/AppShell.tsx`, `app/App.tsx` | Tokeny → komponenty → strony. Wyodrębniać style razem z migracją, usuwać tylko reguły, których zastąpienie jest potwierdzone. Utrzymanie shell podczas zmiany trasy wymaga osobnego sprawdzenia konfiguracji `addAction` i `aside`. |
| Działania i feedback | `components/ActionPrimaryControls.tsx`, `ActionStatusControls.tsx`, `ActionFeedback.tsx`, `pages/StartPage.tsx`, `ActionsPage.tsx`, `ActionDetailPage.tsx`, `GoalDetailPage.tsx` | Jeden wzorzec ukończenia i statusu, obecne komendy, błędy i cofanie. |
| Formularze i ruch | `components/Modal.tsx`, `FormTransition.tsx`, `QuickAdd.tsx`, `ActionEditDialog.tsx`, `CaptureComposer.tsx`, `KnowledgeNoteFields.tsx` | Zachować visualViewport, szkice, stabilny fokus i zabezpieczenie zamknięcia. Nie tworzyć osobnej wersji formularza tylko dla wyglądu. |
| Kontekst i powrót | `components/ContextNavigation.tsx`, `hooks/useNavigationRestoration.ts`, `pages/ProjectDetailPage.tsx`, `pages/focus-detail.css` | Nazwa CSS `focus-detail` jest historyczna; nie przywracać historycznego Focus do aktywnego produktu. |
| Pozostałe moduły | `pages/KnowledgePage.tsx`, `KnowledgeDetailPage.tsx`, `InboxPage.tsx`, `RoutinesPage.tsx`, `ReviewPage.tsx`, `SettingsPage.tsx`, `auth/AuthPage.tsx`, `components/GlobalSearch.tsx`, komponenty AI | Na początku etapu ponownie sprawdzić aktualną implementację; część Podsumowania jest już zmieniona lokalnie. |

Większość prac dotyczy prezentacji i interakcji, bez potrzeby nowych migracji. Jeśli zmiana dotknie zapytań filtrujących albo zapisu, trzeba uwzględnić zgodność parametrów URL, paginację, retry i cofanie. Historyczne snapshoty, reguły Rutyn oraz relacje Wiedzy zachowują własną semantykę.

## Kryteria odbioru całości

| Obszar | Warunek uznania za gotowe |
| --- | --- |
| Rozmiary | 320/360/390/430 px; desktop 1280/1440 px. Bez niezamierzonego poziomego scrolla, obciętych etykiet i kontrolek. Sprawdzić także dzieci kontenerów ukrywających overflow. |
| Czytelność | Ważne metadane co najmniej 13 px; pola 16 px; długie tytuły i większy tekst bez kolizji. 200% powiększenia nie odbiera funkcji. |
| Kontrast | Pomiar na rzeczywistych tłach: cel 4,5:1 dla zwykłego tekstu i 3:1 dla dużego tekstu oraz istotnych elementów kontrolek. Kolor nie jest jedynym komunikatem statusu. |
| Dotyk | Wszystkie główne cele minimum 44×44 px; bez przypadkowego otwierania szczegółu przy ukończeniu lub menu. |
| Nawigacja | Wstecz przywraca listę, jej filtry i pozycję; pełna ścieżka dostępna przy potrzebie. Dodaj zachowuje kontekst Projektu/Celu. |
| Formularze | Nazwa Działania lub treść Notatki wystarcza tam, gdzie pozwala domena. Przy otwartej klawiaturze można dotrzeć do pola, błędu i zapisu. Szkic przetrwa wyjście zgodnie z obecnym modelem. |
| Wynik operacji | Błąd zachowuje wpis i daje retry; sukces nie pojawia się przed potwierdzeniem; Cofnij działa po udanym zapisie; szybkie podwójne dotknięcie nie dubluje operacji. |
| Dostępność | Etykiety ikon, logiczna kolejność odczytu, fokus po zmianach, VoiceOver/TalkBack, reduced motion. Trzeba ćwiczyć realne zadania, a nie tylko sprawdzić obecność ARIA. |
| Ruch i wydajność | Panel nie gubi fokusu przy zamknięciu; animacja nie blokuje kolejnej akcji; brak nieoczekiwanych skoków podczas ładowania. Profil na słabszym telefonie zamiast deklaracji płynności wyłącznie na podstawie desktopu. |
| Stany danych | Pusty Workspace, brak wyników po filtrze, długie treści, duża lista, przerwana sieć, wygasła sesja i konflikt szkicu. Przy braku danych wyjaśnić stan, nie pokazywać fikcyjnego wyniku. |

Weryfikację implementacji oprzeć na istniejących testach nawigacji, Działań, QuickAdd, Modal, szkiców i konkretnych modułów. Dodać testy zachowań zmienionych przepływów, szczególnie jedno dotknięcie/undo, zachowanie kontekstu, błędy i powrót. Nie testować samych wartości odstępów jako logiki produktu.

Przed zamknięciem przyrostu: `pnpm lint`, `pnpm typecheck`, właściwe testy zmienionych przepływów i `VITE_DATA_BACKEND=demo pnpm build`; szersza regresja przy zmianie shell, routingu lub wspólnych komponentów. Podczas realizacji tego planu sprawdzono wszystkie te kontrole; dokładne wyniki i ograniczenia odbioru urządzeń są w raporcie implementacji.

Do porównania przed/po użyć tych samych zadań: ukończ krok ze Startu, zapisz Działanie w Celu, zapisz krótką notatkę, znajdź materiał i wróć, przełóż zaległość, zapisz decyzję tygodnia. Zmierzyć liczbę dotknięć i czas przed zmianą, a po zmianie sprawdzić także pomyłki. Celem projektowym jest jedno dotknięcie do ukończenia prostego Działania oraz otwarcie Dodaj → wpisanie wymaganej treści → zapis. Korzyści czasowej nie deklarować bez pomiaru.

## Decyzje projektowe przyjęte do implementacji

1. **Wygląd:** zachowano ciemny granat, Geist i Lucide; ograniczono dekoracje oraz powiększono tekst i cele dotykowe.
2. **Start:** „Na dziś” jest głównym miejscem pracy. Blok decyzji pozostaje widoczny, gdy istnieje sprawa wymagająca decyzji. AI i sygnały uzupełniają listę.
3. **Dodaj:** zachowano kontekst miejsca otwarcia, jedno wymagane pole i pełny wybór typu. Opcjonalne szczegóły są dostępne po rozwinięciu.

Te decyzje wynikają z domyślnych wskazówek użytkownika i zostały zastosowane w implementacji. Szczegóły i granice weryfikacji są w raporcie.

## Powiązane plany

Wcześniejsze materiały są źródłem kontraktów i szczegółów. Przed wdrożeniem sprawdzić aktualny kod, zamiast odtwarzać cały dawny backlog:

- [Czytelność mobilna](./priority-implementation-2026-09-08/04-mobile-clarity.md): kontekst Działań, dotyk, kontrast i powrót.
- [Dodaj na telefonie](./2026-09-11-dodaj-mobile-plan.md): szkice, klawiatura, wspólne formularze i odbiór urządzeń.
- [Spójne Działania](./2026-09-20-actions-experience-remediation.md): prezentacja statusu, daty, blokady i Rutyny.
- [Wiedza i krótkie notatki](./2026-09-27-knowledge-short-notes-implementation.md): filtry, paginacja, treść notatki i ochrona zapisu.
- [Podsumowanie tygodnia](./2026-09-27-weekly-review-mobile-audit.md): mobilny układ, plan, historia i semantyka zapisu.
- [Fundament UI](../design/ui-foundation-decision.md): kierunek tokenów, typografii i komponentów. Opisane tam biblioteki są decyzjami dokumentacyjnymi; ich instalację należy potwierdzić w bieżącym kodzie.
