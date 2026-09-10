# Pełny przegląd „Dodaj” — specyfikacja poprawek

Data: 2026-09-09. Status: plan, bez implementacji.

Dokument zastępuje diagnozę z `2026-09-09-add-keyboard-plan.md`: w międzyczasie zmieniono AppShell, QuickAdd, Modal, Działania, szczegóły Celu i CSS. Przegląd uwzględnia te istniejące zmiany; nie należy ich nadpisywać starszym planem.

Zakres: wszystkie aktywne wejścia do głównego „Dodaj”, lokalne odpowiedniki tworzenia Działania oraz warianty formularzy, kontekstu, terminu, szkicu i zapisu. Osobne funkcje „zapisz postęp”, „dodaj rezultat”, triage Skrzynki i edycja istniejących obiektów pozostają odrębnymi operacjami; wspólny Modal wymaga jednak ich regresji.

Metoda: przegląd tras, komponentów, warunków renderowania, wywołań zapisu i CSS; dodatkowo oględziny lokalnego mobilnego QuickAdd i pełnej Rutyny. Nie wykonywano zapisów danych ani wszystkich kombinacji w przeglądarce. Błędy zapisu i klawiatury urządzeń opisano jako scenariusze do sprawdzenia. „Wszystkie kombinacje” poniżej oznaczają kompletną macierz reguł, a nie deklarację przetestowania każdej permutacji na urządzeniu.

## 1. Najważniejsze ustalenia

| Priorytet | Ustalenie w aktualnym kodzie | Co trzeba zmienić |
| --- | --- | --- |
| P1 | QuickAdd w trybie Cel pozwala wybrać Cel, ale `createGoal` otrzymuje tylko `areaId`. Wybór Celu nie jest zapisywany. | Dla nowego Celu oferować tylko Projekt. Przy wejściu ze szczegółów Celu można zaproponować jego Projekt, jawnie. |
| P1 | QuickAdd Biblioteki także oferuje Cel, ale go nie przekazuje. Projekt przekazuje jako `projectId`, podczas gdy formularz Projektu używa relacji `areaId`. | Używać wspólnego budowania `relations`, zgodnego z bieżącym modelem Projektów. Zweryfikować widoczność wpisu na stronie Projektu i Celu po zapisie. |
| P1 | Wpisane `/biblioteka`, `/library` i `/wiedza` prowadzą do historycznego `knowledge`, zapisywanego w Skrzynce; kliknięcie Biblioteki prowadzi do `library`. | Jedna mapa komend. `/biblioteka`, `/library`, `/wiedza`, `/notatka` → Biblioteka; `/skrzynka`, `/inbox` → Skrzynka. Historyczne szkice `knowledge` migrować osobno do Skrzynki. |
| P1 | QuickAdd Rutyny zawsze zapisuje tydzień, interwał 1 i początek dzisiaj. Nie pozwala sprawdzić/zmienić dni, końca ani checklisty. | Wyświetlać wspólny formularz Rutyny; żadnego zapisu serii z nieedytowalnym harmonogramem. |
| P1 | Pełna Rutyna zapisuje serię, a następnie materializuje wystąpienia w tym samym `try`. Awaria drugiego kroku wygląda jak awaria całego zapisu. | Zapamiętać ID utworzonej serii. Pokazać „Rutyna zapisana, nie udało się przygotować wystąpień”; ponawiać tylko drugi krok. |
| P1 | QuickAdd pozostaje `display:grid`; dodane `flex` na jego dzieciach nie steruje wysokościami wierszy. | Jawnie ustawić formularz jako flex-column lub grid z wierszami `minmax(0,1fr) auto`, a stopkę dopasować do treści. |
| P1 | Część formularzy można zamknąć i edytować podczas zapisu; po sukcesie czyszczą bieżący stan, również dopisany w trakcie oczekiwania. | Wspólna blokada pól, zmiany typu, zamykania i ponownego wysłania podczas zapisu. Uchwycić payload przed operacją. |
| P2 | Część ścieżek to QuickAdd, część to niezależne okna, a Skrzynka jest rozwijana w stronie. | Jeden gospodarz panelu; formularze zależą od typu, kontekst od miejsca otwarcia. |
| P2 | Szkice mają różną trwałość; pełna Rutyna resetuje formularz przy otwarciu i zmianach tablicy szablonów. | Szkice per typ/kontekst; inicjalizacja tylko przy rozpoczęciu danej sesji tworzenia, bez kasowania edycji przy odświeżeniu danych. |

Pomiar w oglądanym QuickAdd: panel 755 px wysokości, formularz 689 px, wiersze grid około 460 i 220 px; stopka około 220 px. Zrzut pokazuje duży pusty obszar poniżej przycisku. To potwierdzony problem bieżącego układu, niezależny od nieweryfikowanej jeszcze klawiatury telefonu.

Już zmienione: skrót ⌘/Ctrl+J wywołuje `triggerAdd`, QuickAdd nie wymusza fokusu na małym ekranie, istnieje pomiar `visualViewport`, Działania i szczegóły Celu przekazują `QuickAddRequest`. Tych punktów nie traktować jako brakującej implementacji; potrzebują dokończenia i testów.

## 2. Macierz ekranów i wejść

| Ekran / wejście | Obecne zachowanie | Docelowe zachowanie |
| --- | --- | --- |
| Start, główny Dodaj | Globalny QuickAdd, Działanie przypięte do Startu | Działanie; pod polem jawne „Na Starcie · bez terminu”. |
| Start, „Ustal następny krok” w pustym planie | Osobny, rozbudowany formularz Działania | Ten sam formularz i szkic co kontekstowe Dodaj na Starcie. |
| Działania, wszystkie widoki | QuickAdd, bez daty i przypięcia | Zachować domyślne Działanie. Filtry statusu nie nadają statusu nowemu wpisowi. |
| Cele, wszystkie filtry | Osobny formularz Celu; po zapisie przejście do szczegółów | Wspólny formularz Celu; domyślnie pozostać na liście, potwierdzenie z „Otwórz Cel”. |
| Projekty, aktywne/archiwum/kosz | Prosty formularz Projektu | Ten sam prosty formularz we wspólnym panelu. Zawsze powstaje aktywny Projekt. |
| Projekt, Przegląd | Globalny QuickAdd bez przypisania Projektu | Działanie z jawnym przypisaniem bieżącego Projektu. |
| Projekt, Cele | Lokalny Cel z Projektem i opcjonalnym pierwszym krokiem | Wspólny Cel z Projektem, dostępne te same opcje co na liście Celów. |
| Projekt, Działania | Lokalny formularz: nazwa, opis, Cel, data | Wspólne Działanie; Projekt przypisany, lista Celów ograniczona do Projektu. |
| Projekt, Wiedza | Notatka/Materiał/Decyzja z relacją do Projektu | Wspólna Biblioteka z zachowaną relacją Projektu. |
| Szczegóły Celu, główny Dodaj | QuickAdd z Celem i osobnym kluczem szkicu | Zachować Cel, pokazać jego nazwę i wynikający Projekt. |
| Szczegóły Celu, lokalne pole „Nowe Działanie” | Osobny formularz inline i osobny szkic | Korzystać z tego samego modelu Działania. Krótki wpis inline może zostać, z „Więcej szczegółów” otwierającym ten sam szkic. |
| Rutyny, wszystkie/aktywne/wstrzymane | Pełny formularz Rutyny | Ten sam formularz po wejściu z dowolnego ekranu. Filtr „wstrzymane” nie wstrzymuje nowej Rutyny. |
| Rutyny, `newRecurring=1` | Otwiera formularz i usuwa parametr | Zachować jako wejście do wspólnego panelu, bez drugiej instancji formularza. |
| Rutyny, `editSeries=…` | Edycja istniejącej serii | Pozostawić tryb edycji, wyraźnie oddzielony od tworzenia; nie wznawiać szkicu nowej Rutyny. |
| Wiedza → Biblioteka | Osobny formularz trzech rodzajów i wielokrotne powiązania z Celami | Zachować możliwości; udostępnić je również z QuickAdd. |
| Wiedza → Skrzynka | Dodaj przełącza formularz w stronie, bez okna | Otwiera panel Skrzynki. Zamknięcie jest osobną akcją; „Dodaj” nie zmienia się w „Zamknij Skrzynkę”. |
| Szczegóły Działania | Globalny QuickAdd bez kontekstu | Domyślnie nowe Działanie w tym samym Celu/Projekcie; wyraźnie „Nowe Działanie”, bez dziedziczenia daty, statusu i cykliczności. |
| Szczegóły Wiedzy | Globalny QuickAdd | Domyślnie Notatka w Bibliotece; nie kopiować automatycznie wielu powiązań oglądanego wpisu. |
| Podsumowanie | Globalny QuickAdd, domyślnie przypięty do Startu | Działanie bez przypięcia, z jawnym wyborem Startu. |
| Historia Focus, brak/niedostępny obiekt | Globalny QuickAdd | Dodaj bez kontekstu historycznego lub niedostępnego obiektu. |
| Menu Więcej → Dodaj dowolne | Globalny QuickAdd | Otworzyć wybór typu bez klawiatury i bez domyślnego powiązania. |
| ⌘/Ctrl+J | Obecnie to samo `triggerAdd` co przycisk | Zachować; jeśli panel już otwarty, nie otwierać kolejnego i nie zmieniać szkicu. |

Przekierowania `/focus`, `/learning`, `/skrzynka`, `/inbox` i dawne adresy Celu/Działania powinny dziedziczyć regułę docelowej strony. Nie tworzyć odrębnych wariantów formularza dla aliasów URL.

Filtry rodzaju i jednoznaczne filtry Projektu/Celu można wykorzystać jako widoczne wartości początkowe (np. Biblioteka → Materiały). Nie dziedziczyć wyszukiwanej frazy jako tytułu, statusu archiwum/kosza ani wielu niejednoznacznych filtrów. Odtworzony szkic ma pierwszeństwo przed propozycją filtra, ale musi być oznaczony.

## 3. Wygląd panelu

Pierwszy widok na telefonie:

```text
Nowe Działanie                  Zamknij
Typ: Działanie                 Zmień
Nazwa
[ Co chcesz zrobić?                 ]
Projekt: … / Cel: …            Zmień
Termin: bez terminu · Na Starcie
Szczegóły                            >
             przewijana zawartość
─────────────────────────────────────
Szkic zapisany          Dodaj Działanie
             klawiatura systemowa
```

- Zastąpić stale widoczną siatkę sześciu typów pojedynczym wyborem „Typ … Zmień”. Lista typów otwiera się w tym samym panelu, z powrotem do formularza. Nie zasłaniać pola drugą warstwą modalną.
- Dla „Dodaj dowolne” lista jest pierwszym ekranem. Dla wejść kontekstowych od razu formularz, bez dodatkowego kliknięcia.
- Usunąć intro „Jedno miejsce do tworzenia”, powtarzające się opisy i drugi odnośnik „Działanie cykliczne”, skoro Rutyna jest już typem.
- Pomoc z komendami przenieść pod „Skróty” na desktopie. Widoczne opcje i parser muszą korzystać z jednej konfiguracji.
- Nie pokazywać komunikatu „w bieżącym kontekście” bez nazwy tego kontekstu. Zawsze wypisać realne miejsce zapisu lub „Bez powiązania”.
- Nagłówki w poprawnej formie: „Nowe Działanie”, „Nowy Cel”, „Nowy Projekt”, „Nowa Rutyna”, „Dodaj do Skrzynki”, „Dodaj do Biblioteki”. Obecne składanie `Dodaj ${modeLabel}` daje m.in. „Dodaj Rutyna”. Czytnik ekranu odczytuje konkretny nagłówek, nie samo „Dodaj”.

## 4. Specyfikacja każdego typu

### Działanie

Widoczne: nazwa, skrót terminu/przypięcia i powiązanie. W szczegółach: opis, dokładna data, wybór Celu/Projektu i przypięcie. Opis jako osobne pole, nie ukryte znaczenie drugiej linii nazwy. Wklejenie wielolinijkowego tekstu można rozdzielić raz na nazwę/opis, pokazując wynik.

Ujednolicić wszystkie trzy ścieżki: QuickAdd, Start i inline w Celu oraz formularz Projektu. Przy wyborze Celu jego Projekt wynika z relacji Celu. Nie pozwalać zapisać jednocześnie Celu z Projektu A i jawnego Projektu B. Użytkownik może odłączyć kontekst przed zapisem.

Reguły daty: przyciski Dzisiaj/Jutro/Bez terminu zmieniają tylko datę. Przypięcie do Startu jest niezależne i nie jest po cichu kasowane. Zmiana daty ręcznie działa tak samo jak przycisk. W podsumowaniu odróżnić „Na dziś z terminu” od „Przypięte do Startu”. Datę „dzisiaj” liczyć w strefie workspace, odświeżyć przy powrocie do otwartego formularza po północy.

### Cel

Widoczne: nazwa, opcjonalny rezultat, Projekt. W „Dodatkowe”: rodzaj/szablon, pierwszy krok, kryteria. Przenieść zaawansowane opcje spod nagłówka za podstawowe pola. Zachować opcjonalny rezultat zgodnie z obecnym produktem; nie zmieniać tego wymagania bez potrzeby.

Usunąć wybór innego Celu jako rodzica. Przy przejściu Działanie → Cel w obrębie istniejącego Celu odziedziczyć najwyżej jego Projekt, z komunikatem „Nowy Cel w Projekcie …”. Nie tworzyć pozornej hierarchii Cel → Cel.

Opis „Wybór zmienia tylko podpowiedzi” poprawić: wybór szablonu zmienia również zapisywany `kind`. Zmiana własnego szablonu nie może zostawiać nieoznaczonego pierwszego kroku poprzedniego szablonu. Własny tekst ma pierwszeństwo; proponowany krok pokazać do przyjęcia. „Zapisz układ jako szablon” przenieść do zarządzania szablonami lub osobnej, jawnej operacji — anulowanie Celu nie cofa obecnego zapisu szablonu.

### Projekt

Zachować prostotę: nazwa i opcjonalny opis. Nie dodawać terminu, statusu ukończenia ani nadrzędnego Projektu. Globalny i lokalny formularz muszą mieć te same pola, szkic i potwierdzenie. Dodać blokadę zamknięcia podczas zapisu; usuwać poprzedni błąd po korekcie/nowym otwarciu. Nowy Projekt utworzony z archiwum nadal jest aktywny — komunikat powinien to wyjaśniać.

### Rutyna

Jeden formularz oparty na `RecurringActionForm`, również po zmianie typu w QuickAdd. Widoczne: nazwa, częstotliwość, interwał, dni dla tygodnia, początek i 3 najbliższe daty. W dodatkowych: opis, kontekst, koniec, checklista i polityka zaległości. Szablony opcjonalne, pod polem nazwy lub pod „Użyj szablonu”.

| Kombinacja | Wymagane zachowanie |
| --- | --- |
| Dzienna, co 1 lub N dni | Dni tygodnia ukryte i niewysyłane; liczba całkowita 1–99. |
| Tygodniowa, jeden/kilka dni | Co najmniej jeden dzień; kolejność w UI Pn–Nd, pełne nazwy dostępne dla czytnika. |
| Tygodniowa, brak dni | Błąd przy grupie dni i wyjaśnienie przy zapisie. |
| Miesięczna, dzień 29/30/31 | Pokazać regułę krótszych miesięcy; obecna domena używa ostatniego dnia miesiąca. Podgląd musi to odzwierciedlać. |
| Zmiana dzień/tydzień/miesiąc | Zachować ustawienia poszczególnych wariantów w szkicu, wysyłać tylko aktywny wariant. |
| Początek dzisiaj/jutro/inny dzień | Podgląd odpowiada rzeczywistym dniom tygodnia; nie zmieniać ręcznie wybranych dni bez informacji. |
| Początek w przeszłości | Wyjaśnić wynik polityki zaległości; nie tworzyć zaskakującej listy dawnych wystąpień. |
| Koniec pusty/przed początkiem/bez wystąpień | Brak końca dozwolony; błędny zakres blokuje zapis; brak wystąpień jasno opisany. |
| skip_missed / carry_one | Opis: „Pomiń stare terminy” / „Zachowaj najwyżej jedno zaległe”. |
| Inna strefa workspace | Ta sama strefa dla podglądu, zapisu i materializacji. Pełny formularz obecnie nie przekazuje timezone, a store ma fallback Europe/Warsaw. |
| Szablon po wpisaniu treści | Nie nadpisywać nazwy/checklisty bez jawnego zastosowania propozycji. |
| Nowa / edycja serii | Osobny szkic; „Zastosuj do przyszłych wystąpień” tylko w edycji. |

Nie normalizować błędnego interwału 0/pustego automatycznie do 1 podczas zapisu. Pokazać walidację. Podgląd dla niepełnych dat nie powinien generować błędnych dat ani uruchamiać długiego szukania wystąpień. Oddzielić sukces utworzenia serii od ewentualnego błędu przygotowania wystąpień.

### Skrzynka

Jedno wielolinijkowe pole, bez wymaganej nazwy i bez relacji, których komenda nie zapisuje. Zachować cały oryginał. Zastąpić ręczny wybór Tekst/Link automatycznym rozpoznaniem pełnego URL; dla tekstu zawierającego link zachować tekst. Jeśli pozostanie ręczny tryb Link, walidować pełny HTTP/HTTPS i zachować ten tryb w szkicu.

Obie ścieżki używają tego samego `normalizeCapture`, komunikatów i szkicu. Usunąć mylące „Zapisz … Działanie” z etykiety pola, jeśli efektem jest tylko surowy wpis. Przycisk mówi „Zapisz do Skrzynki”. W trakcie zapisu pole jest zablokowane, żeby `draft.clear()` nie usuwało treści dopisanej podczas oczekiwania.

### Biblioteka

Wszędzie udostępnić te same trzy tworzone rodzaje: Notatka, Materiał, Decyzja. Wynik/artefakt jest obecnie filtrowalny, ale nie jest rodzajem tworzonym w tym formularzu — nie dodawać go tylko na podstawie listy filtrów.

| Rodzaj | Pola i walidacja |
| --- | --- |
| Notatka | Tytuł wymagany, treść opcjonalna, powiązania. |
| Materiał | Nazwa wymagana, link HTTP/HTTPS opcjonalny, opis opcjonalny, powiązania. |
| Decyzja | Wybór/nazwa i uzasadnienie wymagane, powiązania. |

QuickAdd nie może nazywać formularza ogólnie Biblioteką i bez wyboru zawsze tworzyć `note`. W Bibliotece użyć prawdziwego `<form onSubmit>`: obecnie `type=url` nie uruchamia natywnej walidacji przez zwykły przycisk `onClick`. Walidację linku ujednolicić niezależnie od natywnej walidacji przeglądarki.

Nie kasować URL przy Materiał → Notatka → Materiał; przechować go w szkicu Materiału, nie wysyłać do Notatki. Lista Celów musi pozwalać szukać, usuwać wybory i pokazać brak wyników. Bieżące powiązanie Projektu ma być widoczne poza zwiniętymi opcjami. Puste listy Projektów/Celów nie powinny blokować samodzielnego wpisu.

## 5. Pełna macierz zmiany typu i kontekstu

Poniższa reguła docelowego typu obowiązuje przy przejściu z każdego z sześciu typów — obejmuje wszystkie 30 przejść między różnymi typami. Kliknięcie aktualnego typu niczego nie resetuje.

| Typ docelowy | Co przenieść do nowego szkicu | Co zrobić z kontekstem |
| --- | --- | --- |
| Działanie | Nazwa + opis; surowy tekst rozdzielić jawnie | Cel lub Projekt, o ile nadal dostępny. |
| Cel | Nazwa + treść jako opcjonalny rezultat | Tylko Projekt; z Celu wyprowadzić jego Projekt i pokazać zmianę. |
| Projekt | Nazwa + opis | Brak rodzica; źródłowe powiązania zostają wyłącznie w szkicu źródłowym. |
| Rutyna | Nazwa + opis | Cel lub Projekt; harmonogram pokazać do ustawienia. Nie udawać, że termin Działania oznacza cykliczność. |
| Skrzynka | Nazwa + pełna treść jako surowy tekst | Jasne „Zapis bez powiązania, uporządkujesz później”. |
| Biblioteka | Nazwa + treść; domyślnie Notatka | Jawne relacje do Celu/Projektu; dla wielu relacji nie redukować po cichu do jednej. |

Jeżeli docelowy typ ma własny niepusty szkic, zaoferować „Wznów szkic” albo „Użyj bieżącej treści”; nie nadpisywać automatycznie. Powrót do źródłowego typu odtwarza jego termin, przypięcie, URL i harmonogram. Typu nie przełączać podczas zapisu. Komendy tekstowe podlegają tym samym regułom i nie kasują treści przy nieznanej komendzie.

| Stan kontekstu | Reguła |
| --- | --- |
| Brak | Jawne „Bez powiązania”, zapis dozwolony. |
| Projekt | Wyświetlić nazwę; wybór Celu ograniczony do Projektu, chyba że użytkownik jawnie zmienia Projekt. |
| Cel w Projekcie | Wyświetlić oba; nie przechowywać sprzecznych niezależnych wartości. |
| Cel bez Projektu | Poprawny kontekst Działania/Rutyny/Wiedzy; dla nowego Celu przejść na „Bez Projektu”. |
| Cel zakończony/wstrzymany | Nie dziedziczyć bez informacji; oznaczyć stan i dopuścić zmianę kontekstu. Regułę dopuszczenia zapisu uzgodnić z istniejącą walidacją domeny. |
| Projekt/Cel w archiwum lub koszu | Nie proponować jako aktywnego kontekstu; przy odzyskanym szkicu wyjaśnić i poprosić o zmianę powiązania. Nie przywracać obiektu automatycznie. |
| Usunięty/niedostępny | Zachować tekst szkicu, oznaczyć nieaktualne powiązanie; nie pokazywać fikcyjnego „Bez powiązania” przy nadal wysyłanym ID. |
| Zmiana workspace | Nie przenosić szkicu ani ID; ponowna walidacja kontekstu przed zapisem. |

## 6. Klawiatura, przewijanie i dostępność

- Uporządkować CSS komponentu zamiast dopisywać kolejne końcowe wyjątki. Nazwać trzy części: nagłówek, treść, akcje. Formularz flex-column lub jawny grid; `min-height:0` na kurczliwych częściach; tylko treść ma przewijanie, stopka wysokość treści.
- Obecne zmienne visualViewport stosować także do pełnych formularzy Rutyny, Celu, Projektu i Wiedzy. Usunąć ich niezależne limity `100dvh`, jeśli nadpisują dostępną wysokość; zweryfikować specyficzność `.modal.knowledge-create-modal` i reguł mobilnych.
- Ustawiać wysokość i górne przesunięcie widocznego obszaru; nie odejmować drugi raz klawiatury. Safe area liczyć raz. Przy zoomie nie traktować każdej zmiany wysokości jako otwarcia klawiatury.
- Telefon: fokus nagłówka/okna przy otwarciu, klawiatura po dotknięciu pola. Desktop/klawiatura sprzętowa: fokus pierwszego właściwego pola. Nie opierać całej polityki na szerokości 767 px — tablet i telefon w poziomie też mają klawiaturę ekranową.
- Usunąć pozostałe mobilne `autoFocus` z formularzy, które nadal go używają. Utrzymać pozycję kursora i pole przy zmianach stanu; zapewnić widoczność kursora po zmianie rozmiaru viewportu.
- Długie textarea: rosną do ustalonej części dostępnego miejsca, potem przewijają treść; etykiety i pomoc nie nakładają się na wpis. Przy bardzo niskiej wysokości zwijać opisy i pokazywać kompaktowy pasek zapisu, nie zmniejszać fontu pola poniżej 16 px.
- Tło powinno być nieaktywne (`inert` lub równoważny mechanizm), nie tylko mieć `overflow:hidden`. Blokada scrolla z zachowaniem pozycji i obsługą stosu okien; `aria-modal` samo nie blokuje interakcji.
- `Modal` nie uwzględnia `summary` w liście elementów fokusu. Dodać je, pomijać tylko ukryte dzieci `details`, sprawdzać również niewidocznych przodków. Przy braku aktywnych pól fokus zostaje w oknie.
- Przy `closeDisabled` efekt fokusu jest ponownie czyszczony, co może przywracać fokus do tła w trakcie zapisu. Oddzielić cykl otwarcia/zamknięcia od aktualizacji blokady zapisu.
- Escape najpierw zamyka listę wyboru, potem panel. `MultiCombobox` obecnie nie zatrzymuje propagacji Escape, a Modal obsługuje je globalnie. Strzałki mają przewijać aktywną opcję; lista powinna zmieścić się nad klawiaturą i zamykać po utracie fokusu.
- Back telefonu zamyka panel/wybór typu przed opuszczeniem strony i zachowuje szkic. Nie tworzyć dwóch paneli przez skrót dodawania podczas wyszukiwania/edycji.
- Status szkicu nie może zajmować pustego, wysokiego wiersza; błąd zapisu szkicu musi dawać dostęp do ponowienia i kopiowania. Nie powtarzać całego formularza przez `aria-live` przy każdym znaku.

## 7. Stany zapisu i szkiców — wspólna specyfikacja

| Stan | Widok i zachowanie |
| --- | --- |
| Pusty formularz | Jasne wymagane pola, wyłączony zapis, bez pustego statusu szkicu. |
| Same spacje | Nie aktywują zapisu; jednolita walidacja `trim`. |
| Poprawny szkic | Cichy status „Szkic zapisany”; osobna akcja odrzucenia. |
| Odzyskany szkic | Informacja o typie i kontekście; brak cichego nadpisania wartościami bieżącej strony. |
| Zmiana/wyjście/odświeżenie | Zachować szkic; szybkie zamknięcie przed debounce 450 ms również musi zachować ostatnią zmianę. |
| Uszkodzony/stary szkic | Bez awarii; migracja walidowanych pól, komunikat i możliwość rozpoczęcia od nowa. |
| Brak dostępu do localStorage | Formularz nadal działa; status mówi, że szkic nie został zapisany. |
| Zapis trwa | „Zapisywanie…”, pojedyncza operacja; pola, typ i zamknięcie zablokowane. |
| Błąd walidacji | Wiadomość przy polu; rozwinąć sekcję błędu, przenieść fokus i przewinąć do niej. |
| Błąd sieci | Treść pozostaje, przycisk ponowienia; nie sugerować sukcesu. Przy niepewnym wyniku użyć mechanizmu idempotencji/uzgodnienia wyniku zamiast nowego ID przy każdym ponowieniu. |
| Sukces | Wyczyścić tylko zapisany szkic, zamknąć panel; komunikat nazywa obiekt i oferuje „Otwórz”. |
| Sukces ukryty filtrem | Komunikat „Zapisano; bieżący filtr go nie pokazuje”, możliwość otwarcia; nie resetować filtrów bez potrzeby. |
| Zapis serii udany, wystąpienia nie | Oddzielny częściowy sukces, ponowienie tylko przygotowania wystąpień. |

Szkic identyfikować przez użytkownika, workspace, operację nowy/edycja, typ i ID kontekstu. Nie dzielić szkicu według samego URL/filtra. Historyczny `global-quick-add` odczytać przez walidowaną migrację; `knowledge` oznacza dawną Skrzynkę. W bieżącym QuickAdd typ jest częścią wartości, a nie klucza — to wymaga zmiany, żeby powrót do Działań nie otwierał np. wcześniej wybranej Rutyny.

## 8. Zakres zmian w kodzie i kolejność

1. **Modal + styles.css**: naprawić potwierdzony grid/stopkę, wydzielić wspólny układ formularza, domknąć viewport, fokus, Escape i blokadę tła. Sprawdzić także wyszukiwanie, dialogi potwierdzeń i edycję.
2. **domain/quickAdd.ts + QuickAdd.tsx**: ujednolicić nazwy/komendy, usunąć pozorne powiązania, dodać normalizację legacy `knowledge`, zastąpić sześć uproszczonych zapisów wspólnymi formularzami typów. Najpierw naprawić ryzyko zapisu w złym miejscu.
3. **AppShell.tsx**: jeden stan panelu i jawne żądanie `{type, context, defaults, entryPoint}`. Wyeliminować konkurencję `onClick` i `quickAdd` jako dwóch niezależnych systemów. Ponowne otwarcie nie resetuje danych, aktywna warstwa blokuje drugi modal.
4. **StartPage, ActionsPage, GoalDetailPage, ProjectDetailPage**: jedna implementacja Działania i normalizacji kontekstu. Podłączyć lokalne przyciski i inline do wspólnego szkicu; poprawić domyślne dodawanie w Przeglądzie Projektu.
5. **GoalsPage + ProjectsPage**: wydzielić formularze do ponownego użycia, zachować opcje, przenieść zaawansowane sekcje niżej, ujednolicić walidację i cykl zapisu.
6. **RecurringActionForm + RoutinesPage**: wspólny tryb create/edit, persistent draft, strefa workspace, jawny harmonogram i częściowy sukces materializacji.
7. **KnowledgePage + ProjectDetailPage + CaptureComposer + MultiCombobox**: wspólne rodzaje Biblioteki i relacje; Skrzynka w panelu; walidacja URL, zachowanie URL przy zmianie rodzaju, obsługa listy nad klawiaturą.
8. **usePersistentDraft i testy**: migracja, izolacja, szybkie zamknięcie, nieaktualny kontekst; regresje zachowania zamiast testów konkretnych klas CSS.

## 9. Macierz odbioru

Nie mnożyć mechanicznie wszystkich parametrów. Wszystkie wejścia sprawdzić na domyślnym wariancie; wszystkie warianty każdego formularza we wspólnym panelu; kombinacje wysokiego ryzyka sprawdzić łącznie.

- **Wejścia:** każdy wiersz sekcji 2, klik i skrót, pusty/pełny widok, aktywny filtr. Efekt musi zgadzać się z etykietą, kontekstem i miejscem zapisu.
- **Typy:** wszystkie 30 przejść z sekcji 5; do każdego wejść bez tekstu, z tekstem i z istniejącym szkicem docelowego typu. Parser sprawdzić dla każdego aliasu, polskich znaków, spacji/nowej linii i nieznanej komendy.
- **Powiązania:** brak/Projekt/Cel z Projektem/Cel bez Projektu; zmiana i usunięcie wyboru; kontekst zarchiwizowany, usunięty i innego workspace; długie nazwy i brak wyników wyszukiwania.
- **Działanie:** brak/dzisiaj/jutro/inny termin × przypięte/nieprzypięte; zmiana przyciskiem i datą; przejście przez północ w strefie workspace.
- **Cel:** pusty/systemowy/własny szablon; zmiana szablonu po wpisaniu pierwszego kroku; z/bez rezultatu, kryteriów, Projektu i pierwszego kroku.
- **Rutyna:** każdy wiersz tabeli w sekcji 4; co 1/co N, błędny interwał; dni 29–31, luty i rok przestępny; brak dat; obie polityki zaległości; create/edit; błąd materializacji po poprawnym zapisie.
- **Biblioteka:** 3 rodzaje × bez/z relacją; pusty/poprawny/błędny URL; Decyzja bez uzasadnienia; przejście Materiał → Notatka → Materiał; wiele Celów i kontekst Projektu.
- **Skrzynka:** tekst, sam URL, tekst z URL, wiele linii, błędny link w trybie Link; treść zachowana bez transformacji w Działanie.
- **Stan:** pusty, szkic, odtworzenie, błąd storage, ładowanie, błąd walidacji/sieci, ponowienie, sukces i wynik ukryty filtrem.
- **Urządzenia:** desktop z myszą i klawiaturą; telefon 320/390/430 px; tablet; orientacja pozioma; powiększenie tekstu i zoom. Safari/iPhone i Chrome/Android z realną klawiaturą, opcjonalnie standalone.
- **Klawiatura:** otwarcie/zamknięcie, przejście między nazwą/opisem/datem/listą, długi tekst, zmiana rodzaju i powrót, obrót, wyszukiwanie powiązania, błąd pola w zwiniętej sekcji. Zapis i aktywne pole osiągalne bez ukrywania klawiatury.
- **Dostępność:** Tab/Shift+Tab/summary, Escape w comboboxie i modalu, brak wejścia do tła, przywrócenie fokusu i scrolla, czytelne nazwy typów, brak przeskoku fokusu podczas zapisu.

Warunek końcowy: każda widoczna opcja ma odpowiadający jej efekt zapisu; te same dane tworzą ten sam obiekt niezależnie od miejsca wejścia; klawiatura nie zasłania akcji ani edytowanej treści; zmiana typu, błąd i zamknięcie nie powodują utraty szkicu.
