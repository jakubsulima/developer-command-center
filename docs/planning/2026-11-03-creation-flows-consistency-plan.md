# Plan ujednolicenia dodawania w aplikacji

Data: 3 listopada 2026. Status: implementacja lokalna; odbiór rzeczywistych urządzeń pozostaje otwarty.

Uzupełnienie z 4 listopada: wykonano odbiór na żywym UI w przeglądarce IAB,
z zapisami w lokalnym demo i kontrolą wznowienia na pierwotnej karcie Supabase.
Poprawiono niewłaściwy typ przy migracji szkicu, niewidoczne materiały
przekazane z książki oraz brak stylów kategorii przy świeżym wejściu.
Macierz wejść, zrzuty i granice dowodu:
[raport przeglądarkowy](../design/creation-flows-2026-11-04/README.md).

## Realizacja lokalna — 3 listopada 2026

Wykonano etapy 1–5 i automatyczną część etapu 6. Poniższy opis stanu
sprzed implementacji pozostaje zapisem uzasadnienia planu.

Kontrole końcowe: lint, typecheck i build demo poprawne; pełny zestaw
**77 plików / 556 testów** przeszedł, `git diff --check` bez błędów.

| Etap | Wykonany zakres |
| --- | --- |
| 1 | `CreationDialog`, `CreationBody`, `CreationFooter`: geometria na bazie Modala, jedna przewijana treść, stopka, visualViewport i safe areas z istniejącej obudowy. Nowe reguły ograniczone do `.creation-dialog`; zastane `polish.css` i `focus-detail.css` zachowane. |
| 2 | Wspólne Działanie z listy, Startu, Projektu i Celu. `InlineGoalAction` współdzieli model, klucz i potwierdzenie z panelem; Więcej szczegółów zachowuje nazwę, opis, datę i kontekst. Termin pozostaje niezależny od przypięcia. |
| 3 | Jeden formularz Celu, Projektu i Rutyny na obu szerokościach. Zachowane rodzaje i szablony Celów, kryteria, pierwszy krok, kategorie i szablony Projektów oraz presety, checklista i pełny harmonogram Rutyn. Usunięte zastąpione lokalne ścieżki tworzenia; edycja serii pozostaje osobną operacją. |
| 4 | Jeden `CaptureComposer` i lokalny szkic Capture; pełny formularz Wiedzy obsługuje książki i notatki źródłowe. Dodaj materiał przy Działaniu otwiera Materiał, a Notatka wymaga tylko treści. Zachowane osobne relacje `material`, `reference`, `source`. Triage używa współdzielonych pól i swojej komendy. |
| 5 | Trwały szkic rezultatu Działania i postępu Celu, blokady zapisu, bezpieczne potwierdzenie oraz stopki kategorii i szablonów. Widoczny fallback lazy importu; reduced motion omija czas zamykania. Usunięte konkurujące `autoFocus`. Sukces pozostawia bieżący ekran i udostępnia Otwórz, także poza filtrem. |
| 6 | Rozszerzone testy formularzy, migracji szkiców, równoważnych wejść, partial success i SQL. Wyniki końcowych kontroli oraz granice odbioru zapisano w [design-qa.md](../../design-qa.md). |

Szkice mają zakres User/Workspace/kontekst/typ. Zmiana typu zachowuje dane;
istniejący, różniący się szkic docelowy pozostaje nadrzędny, a przenoszona
wersja trafia do jawnego odzyskiwania. Źródła migracji nie są usuwane podczas
autosave. Dopiero potwierdzony sukces czyści wybraną, niezmienioną kopię;
konflikty i kopie odzyskiwania pozostają dostępne.

Potwierdzenie jest utrwalane oddzielnie oraz w szkicu. Błąd sprzątania nie
uruchamia ponownie tworzenia; częściowa Rutyna po ponownym otwarciu ponawia
wyłącznie przygotowanie wystąpień. Działanie, notatka i Capture zachowują
identyfikator próby. Po niepotwierdzonej próbie Działania lub notatki pola
pozostają zablokowane, aby retry wysłało tę samą treść. Nie dodano gwarancji
idempotencji dla tworzenia Celów, Projektów, Rutyn ani rezultatów.

Korekta z 4 listopada: zmiana typu nie kopiuje klucza operacji między
niezależnymi szkicami; istniejący szkic docelowy zachowuje własny klucz.
Schemat szkicu v3 rozdziela wcześniejsze kolizje niewysłanych szkiców v2,
bez zmiany klucza prób wysłanych lub potwierdzonych. Jednoznaczne odrzucenie
pierwszej próby odblokowuje Działanie i notatkę oraz umożliwia poprawioną
próbę z nowym kluczem, również po wznowieniu i w formularzu inline.
Błędy transportu i nieznane wyniki pozostają zamrożone. Odrzucenie retry
po wcześniejszej utracie odpowiedzi nie dowodzi braku wcześniejszego zapisu.
Szczegóły regresji i końcowe wyniki: [design-qa.md](../../design-qa.md).

Lokalna migracja
[`20261103200435_creation_triage_goal_options.sql`](../../supabase/migrations/20261103200435_creation_triage_goal_options.sql)
rozszerza istniejący atomowy triage o rodzaj, szablon i kryteria Celu oraz
niezależne powiązania notatki z Projektem, Celem i książką źródłową. Nie
zmienia sygnatury RPC ani zakresu uprawnień. Wymaga późniejszego wdrożenia
przed użyciem tych nowych opcji z produkcyjnym backendem; tej migracji nie
wdrażano w ramach zadania.

4 listopada potwierdzono układ 320 × 480 / 390 × 844 / 767 / 768 / 1440 px
w silniku przeglądarki i zapisano nowe zrzuty. Wcześniejszy brak dostępu do
przeglądarki nie jest już blokadą. Otwarty pozostaje odbiór fizycznej
klawiatury iOS Safari/PWA i Android Chrome, pomiar płynności oraz wymuszona
odwrócona kolejność ładowania CSS. Błędy sieci, wolny zapis i częściowa Rutyna
mają regresje automatyczne; nie były wstrzykiwane do żywej karty.
Testy JSDOM i lokalnego PGlite nie zastępują odbioru urządzenia.

Nawet podwójny lokalny zapis potwierdzenia nie zapewnia trwałości, gdy po
odpowiedzi serwera całkowicie przestaje działać storage i jednocześnie
zostaje zamknięta karta. Dla operacji bez idempotencji nie deklarujemy
ochrony przed ponowieniem po utracie odpowiedzi sieciowej.

Dodawanie jest rozdzielone między QuickAdd, lokalne okna, formularze w stronie
i Szybki zapis. Największą przeszkodą jest zmiana reguł tej samej czynności
w zależności od ekranu i szerokości urządzenia: dostępne pola, szkice, walidacja
i zachowanie po zapisie różnią się. Poprawki powinny najpierw ujednolicić te
reguły, a potem dopracować ruch i wygląd zgodnie z mobilnym wariantem A.

Zakres obejmuje Szybki zapis, Działania, Cele, Projekty, Rutyny, Wiedzę,
książki, notatki przy książkach, dodawanie przy Działaniu, porządkowanie
Skrzynki, postęp Celu i krok w planie tygodnia. Kategorie i własne szablony
otrzymują ten sam standard formularza, pozostając narzędziami ustawień.

## Stan sprawdzony obecnie

Poniższe obserwacje wynikają z kodu bieżącego drzewa roboczego. To nie jest
pomiar animacji, opóźnień ani układu na żywym urządzeniu.

| Miejsce | Potwierdzona różnica | Skutek dla użytkownika |
| --- | --- | --- |
| Przycisk przy tytule strony | `AppShell.triggerAdd` poniżej 768 px preferuje `quickAdd`, a na desktopie `onClick`. Dotyczy m.in. Celów, Projektów, Rutyn i sekcji Projektu. | Ta sama czynność ma inny formularz i zakres możliwości po zmianie urządzenia. |
| Cel | QuickAdd zapisuje nazwę, rezultat i Projekt. Pełny formularz ma też rodzaj, szablon, pierwszy krok i kryteria; po utworzeniu przenosi do szczegółów. Formularz w Projekcie ma jeszcze inny zakres. | Na telefonie brakuje części opcji; po zapisie raz pozostajemy na ekranie, a raz go opuszczamy. |
| Działanie | QuickAdd, lokalny formularz Projektu i inline w Celu mają różne pola oraz osobne szkice. Start zachował również dawny formularz otwierany dla wcześniejszego szkicu. | Przejście do pełniejszego wpisu nie jest kontynuacją tego samego szkicu. |
| Termin na Starcie | Główne Dodaj proponuje dzisiejszy termin; wcześniejszy formularz Startu używa niezależnego przypięcia, a jego szybkie daty zmieniają też przypięcie. | Podobny wybór dnia ma różne konsekwencje. |
| Rutyna | QuickAdd ma rytm, interwał, początek i dni. Pełny formularz ma dodatkowo koniec, checklistę i politykę zaległości oraz przygotowuje wystąpienia. | Zakres i zakończenie tworzenia zależą od wejścia. |
| Projekt | Lokalny `openCreate` korzysta z filtra kategorii i resetuje formularz. Żądanie do QuickAdd nie przekazuje tego filtra. | Tworzenie na tej samej przefiltrowanej liście ma różne wartości początkowe. |
| Skrzynka | Na desktopie Dodaj rozwija Capture w stronie, a na telefonie zwykle otwiera QuickAdd. Globalny Szybki zapis używa `CaptureComposer`. Są różne klucze szkiców. | Kilka wersji tej samej czynności, różny powrót do tekstu i różna obsługa ponawiania. |
| Wiedza przy Działaniu | `ActionKnowledgeRelations` wymaga tytułu również dla notatki i nie korzysta z `prepareKnowledgeNote` ani trwałego szkicu. W szczególe przycisk „Dodaj materiał” otwiera domyślnie formularz rodzaju `note`. | Notatka ma inne wymagania niż w Bibliotece, a etykieta wejścia nie odpowiada początkowemu rodzajowi. |
| Zamykanie podczas zapisu | Część lokalnych okien blokuje krzyżyk przez `closeDisabled`, ale pola i przycisk Anuluj pozostają aktywne, np. nowy Cel/Projekt; lokalne Cel i Działanie w Projekcie nie przekazują tej blokady. | Można zmienić treść lub zamknąć formularz przed potwierdzeniem zapisu; wynik wymaga ujednolicenia. |
| Klawiatura i przewijanie | `Modal` odsłania pole w `[data-modal-scroll-body]`. QuickAdd i pełna Biblioteka oznaczają taką treść; część lokalnych formularzy i Capture nie ma tego podziału. `CaptureComposer` i `KnowledgeNoteFields` mają też `autoFocus`, poza polityką początkowego fokusu Modala. | Są różne mechanizmy układu i ustawiania fokusu. Ich wpływ na rzeczywistą klawiaturę wymaga odbioru. |
| Animacja i style | QuickAdd ma osobne wejście/wyjście, `FormTransition` animuje zmianę pól, lokalne okna używają innych ustawień. Reguły tworzenia są rozproszone w `styles.css` i późniejszym `polish.css`. | Wspólna nazwa komponentu nie zapewnia wspólnego zachowania ani wyglądu. |

Nie należy ponownie wdrażać jako brakujących rzeczy już obecnych: QuickAdd
ma rozdzielone nazwę i opis, kontekst Projektu/Celu, edytowalny harmonogram,
blokadę ponownego wysłania, trwały szkic i układ korzystający z visual viewport.
Pełna Rutyna rozpoznaje częściowy sukces i w otwartej sesji ponawia samo
przygotowanie wystąpień. Szybki zapis zachowuje identyfikator próby i tekst
po niepotwierdzonym zapisie. Te mechanizmy są podstawą dalszych prac.

Starsze plany wrześniowe są częściowo wykonane. Zakres planu z 24 października
ma już częściową realizację w kodzie Szybkiego zapisu, choć indeks planów nadal
nazywa go planem do wdrożenia. `design-system.md` zawiera historyczne Focus/Commitments;
język produktu należy brać z `CONTEXT.md`, a bieżący kierunek wyglądu z
`design-qa.md` i wariantu A, zamiast przywracać historyczne ekrany.

## Najważniejsze poprawki

| Priorytet | Zmiana | Co jest potrzebne | Korzyść | Ryzyko i zależności |
| --- | --- | --- | --- | --- |
| P1 | Jeden formularz danego typu na telefonie i desktopie | Wspólne pola i model formularza; wejścia przekazują kontekst, bez wyboru innej implementacji przez breakpoint. | Te same opcje i przewidywalny przebieg w każdym miejscu. | Uproszczenie nie może usunąć szablonów, kryteriów, checklist ani książek. Migracja typami po przygotowaniu wspólnej obudowy. |
| P1 | Jeden standard szkicu i zapisu | Blokada wszystkich dróg wysłania/zamknięcia podczas zapisu; utrwalony payload; zachowanie tekstu po błędzie; oddzielny stan zapisu zakończonego z błędem sprzątania szkicu. | Brak znikającej treści, przypadkowych zmian i ponownego tworzenia po sukcesie. | Migracja istniejących kluczy może nadpisać różne szkice. Kopiować bez kasowania źródeł do czasu potwierdzenia, konflikt pokazywać jawnie. |
| P1 | Spójny Capture do Skrzynki | Wspólny `CaptureComposer` także dla dodawania do Skrzynki; zachowanie identyfikatora próby. | Jeden prosty zapis z dowolnego ekranu. | Nie scalać automatycznie różnych istniejących szkiców ani nie dodawać obowiązkowej klasyfikacji. |
| P1 | Ten sam model krótkiej notatki wszędzie | `KnowledgeNoteFields`, `prepareKnowledgeNote`, szkic w kontekście oraz właściwa relacja do Działania/książki/Projektu. | Wszędzie wystarcza sama treść; tytuł jest opcjonalny. | Nie zgubić ról `material`, `reference`, `source` ani istniejących powiązań. |
| P1 | Wspólna geometria panelu i obsługa klawiatury | Nagłówek, jedna przewijana treść, stała stopka; wspólna polityka fokusu i visual viewport. | Zapis pozostaje osiągalny, pola nie znikają pod klawiaturą, ekran nie przeskakuje przy zmianie typu. | Zmiany wspólnego Modala dotykają edycji, wyszukiwania i eksportu AI. Style nowej obudowy muszą mieć ograniczony zakres. |

## Poprawki o średnim priorytecie

| Priorytet | Zmiana | Co jest potrzebne | Korzyść | Ryzyko i zależności |
| --- | --- | --- | --- | --- |
| P2 | Jedna kolejność informacji i zgodność z wariantem A | Treść/nazwa, widoczny kontekst, istotne ustawienia, dodatkowe opcje. Wspólne tokeny fontów, odstępów, pól i przycisków. | Formularze wyglądają jak część tej samej aplikacji; krótszy pierwszy widok. | Nie ukrywać harmonogramu Rutyny ani wymaganego uzasadnienia Decyzji. |
| P2 | Jedno potwierdzenie i przewidywalny powrót | Po sukcesie pozostać w miejscu pracy, krótki komunikat z Otwórz; od razu pokazać nowy wpis, również gdy nie pasuje do filtra. | Wiadomo, czy zapis się udał i gdzie znaleźć wynik. | Potrzebne uzgodnienie z listami stronicowanymi i filtrami; nie przestawiać całej listy bez potrzeby. |
| P2 | Spójne przejścia i stan otwierania | Te same czasy i kierunek ruchu, zachowanie fokusu i scrolla, reduced motion; widoczny stan ładowania panelu przy pierwszym otwarciu. | Brak cichego kliknięcia i nagłych zmian układu. | Animacja nie może opóźniać interakcji. Ewentualny preload dopiero po pomiarze pierwszego otwarcia. |
| P2 | Uporządkowanie pozostałych małych formularzy | Postęp, rezultat, kategorie, szablony oraz istniejące powiązania korzystają ze wspólnych pól, błędów i stanów zapisu. | Spójność obejmuje także mniej częste miejsca. | Zachować ich osobne znaczenie; połączenie istniejącego wpisu nie tworzy nowego obiektu. |

## Docelowe zachowanie każdego wejścia

Wspólny formularz nie oznacza identycznej zawartości dla wszystkich typów.
Szybki zapis pozostaje jednym polem, Rutyna potrzebuje harmonogramu, a Cel
opcjonalnego pierwszego kroku. Różnić może się treść, a nie reguły obsługi.

| Wejście | Docelowy przebieg |
| --- | --- |
| Dolne Zapisz, górny Szybki zapis, ⌘/Ctrl+J | Jeden Capture, tekst lub link → Skrzynka. Bez domyślnego Projektu i bez wybierania rodzaju. |
| `/capture`, skrót iPhone | Ten sam Capture w samodzielnej stronie; po sukcesie Otwórz, Uporządkuj i Zapisz kolejną myśl. Zachować prostotę tej strony. |
| Więcej → Dodaj dowolne | Najpierw wybór typu bez automatycznego otwierania klawiatury; potem wspólny formularz wybranego typu. |
| Start → Dodaj Działanie | Od razu Działanie z widocznym „Dzisiaj”, bez dodatkowego przypięcia. Poprzedni szkic Startu można wznowić w tym samym formularzu, z zachowaniem jego daty i przypięcia. |
| Lista Działań | Działanie bez terminu; jednoznaczny filtr Projektu/Celu może proponować widoczny kontekst. Filtr statusu nie nadaje stanu nowemu wpisowi. |
| Lista Celów / Projektów / Rutyn | Od razu właściwy formularz, z takim samym zakresem opcji na każdym urządzeniu. Kategorie Projektu wynikają z jawnego filtra, jeśli brak wcześniejszego szkicu. |
| Projekt → Przegląd | Projekt Standardowy: Dodaj otwiera wybór typu z widocznym Projektem; bez dodatkowego wybierania Projektu w formularzu. Czytelnia: Dodaj książkę. Jawny przycisk Dodaj Działanie otwiera bezpośrednio Działanie. |
| Projekt → Cele / Działania / Wiedza | Właściwy typ i przypisany Projekt; w Działaniu wybór Celu ograniczony do Projektu. Zmianę Projektu należy wykonać jawnie, z ponowną kontrolą Celu. |
| Czytelnia → Dodaj książkę / Połącz istniejącą | Nowy Materiał w formacie książki albo wybór istniejącej książki; obie operacje pokazują Projekt. Zachować jeden wspólny obiekt książki. |
| Cel → Dodaj i pole inline | Ten sam szkic Działania z Celem i wynikającym Projektem. Inline zachowuje szybki zapis; Więcej szczegółów kontynuuje ten sam tekst, datę i szkic w panelu. |
| Działanie → Dodaj materiał / Połącz wiedzę | Materiał otwiera rodzaj `resource`, z relacją `material` do Działania. Zmiana na Notatkę używa wspólnego modelu notatki i jawnej właściwej roli. Połącz wybiera istniejący obiekt. |
| Działanie → Dodaj rezultat | Nadal zapis lub powiązanie Rezultatu; wspólna obudowa, zachowany szkic według Działania. Dodanie rezultatu nie zmienia automatycznie statusu Działania. |
| Wiedza → Biblioteka | Wspólny formularz Notatki/Materiału/Decyzji; filtr rodzaju, książek, Projektu i Celu proponuje wartości tylko dla nowego pustego szkicu. |
| Wiedza → Skrzynka, także pusty stan | Ten sam Capture co globalnie, we wspólnym panelu. Osobna akcja Zamknij; przycisk Dodaj nie staje się przełącznikiem formularza. |
| Książka → Dodaj notatkę | Treść jako główne pole, tytuł opcjonalny, widoczne źródło; relacja `source` pozostaje niezależna od Projektu i Celu. |
| Skrzynka → Uporządkuj → Cel/Działanie/Wiedza | Te same pola i walidacja typu, ale zapis przez istniejącą operację triage. Zachować oryginał, status przetworzenia i podgląd propozycji AI. |
| Cel → Zapisz postęp | Krótki formularz w stronie; trwały szkic dla Celu, blokada zmiany pól przy zapisie, czytelny sukces i pozostanie na osi czasu. |
| Podsumowanie → Plan → Dodaj krok | Zachować formularz inline i istniejący identyfikator próby, wybrany Cel oraz dzień. Wygląd pól i błędów zgodny z Działaniem. |
| Kategorie Projektów i własne szablony Celów | Wspólne stany pól/zapisu. Tworzenie szablonu pozostaje osobną operacją ustawień; nie zapisuje się jako uboczny efekt anulowanego Celu. |
| Niedostępny obiekt i historia Focus | Brak dziedziczenia kontekstu z niedostępnego lub historycznego obiektu; Szybki zapis nadal dostępny. |

## Reguły wspólnego formularza

### Wygląd i płynność

- Korzystać z istniejących tokenów i wariantu A. Jedna powierzchnia formularza,
  bez osobnych gradientów, dekoracyjnych podsumowań i numerowanych sekcji
  powtarzających proste pola. Zachować bieżące poprawki szczegółów i list.
- Desktop: wyśrodkowane okno o szerokości dostosowanej do typu. Telefon:
  obudowa zgodna z obecnym QuickAdd, nagłówek i stopka niezależne od przewijanej
  treści, wysokość wynikająca z rzeczywistego visual viewport i safe areas.
- Wspólna skala odstępów 8/12/16/24 px; pola tekstowe na telefonie 16 px,
  cele dotykowe co najmniej 44 px; przycisk zapisu w stałym miejscu stopki.
- Działanie: nazwa, widoczny odziedziczony kontekst, wybór terminu, dodatkowe
  opcje. Cel: nazwa, Projekt i opcjonalny rezultat; rodzaj, pierwszy krok
  i kryteria w dodatkowych opcjach. Notatka: treść, kontekst i opcjonalne Więcej.
- Propozycja ruchu: otwarcie 180–220 ms, zamknięcie 140–180 ms, zmiana pól
  120–160 ms. Jeden subtelny ruch na daną zmianę, bez kumulowania animacji
  obudowy, zawartości i opisów. `prefers-reduced-motion` wyłącza ruch i zbędne
  oczekiwanie na animację zamknięcia.
- Rozwijanie opcji nie remountuje pól, nie traci kursora i nie odtwarza
  całego formularza. Nie animować wysokości przy zmianie klawiatury.
- Desktop ustawia fokus w głównym polu; na telefonie wejście kontekstowe
  respektuje jedną wspólną politykę, a wybór typu nie wymusza klawiatury.
  Usunąć konkurencję `autoFocus` i mechanizmu Modala. Przewijanie wykonane
  świadomie przez użytkownika ma pierwszeństwo przed korektą fokusu.
- Pierwsze otwarcie panelu ładowanego przez lazy import musi dawać widoczny
  sygnał. Zmierzyć czas kliknięcie → gotowe pole przed decyzją o preloadzie;
  nie deklarować obecnie regresji wydajności na podstawie samego kodu.

### Kontekst, szkice i zapis

- Priorytet inicjalizacji: istniejący szkic → jawny kontekst wejścia →
  jednoznaczny filtr → domyślne wartości typu. Wznowiony szkic pokazuje swoje
  rzeczywiste powiązania; nie zmienia ich po cichu na aktualnie oglądany Projekt.
- Klucz szkicu obejmuje użytkownika, Workspace, typ i kontekst obiektu.
  Równoważne wejścia, np. panel i inline tego samego Celu, używają tego samego
  szkicu. Nie scalać wpisów z innych Celów, książek lub operacji triage.
- Migracja musi objąć `global-quick-add`, `quick-add:*`, `start-action`,
  `goal-action`, `routine-new`, `knowledge-create`, szkice Projektu/książki
  oraz Capture. Jeżeli docelowy i dawny szkic mają różną treść, udostępnić
  odzyskanie obu; nie wybierać automatycznie jednego do nadpisania.
- Termin i przypięcie do Startu są niezależne. Dzisiaj/Jutro/Bez terminu
  zmienia wyłącznie termin. Zmiana typu nie usuwa tekstu, a kontekst jest
  normalizowany według możliwości typu. Nowy Cel dziedziczy Projekt, nie Cel.
- Rozdzielić dane szkicu od stanu prezentacji. Po zakończeniu sesji resetować
  np. wybór widoku daty i rozwinięcia; przy wznowieniu wyliczyć je z danych,
  aby stary stan lokalny nie przeczył aktualnej dacie/polom.
- Zapis ma stany: edycja → zapisywanie → sukces albo błąd. Na czas wysyłania
  zamrozić payload i wyłączyć pola, zmianę typu, ponowne wysłanie, X, Escape,
  tło i przycisk Zamknij. Nie mylić zapisu szkicu z zapisem obiektu.
- Błąd zachowuje treść i kontekst. Przy niepewnym wyniku ponawiać tę samą
  operację tam, gdzie kontrakt ma idempotencję; nie rozszerzać tej gwarancji
  na typy, które jej obecnie nie mają. Ewentualne rozszerzenie kontraktów
  repozytorium traktować jako osobne, uzasadnione zadanie z testem integracyjnym.
- Po potwierdzonym sukcesie błąd usunięcia szkicu daje akcję sprzątania,
  a nie ponowne utworzenie obiektu. Częściowy sukces Rutyny ponawia wyłącznie
  przygotowanie wystąpień; wznowienie po zamknięciu nie może tworzyć nowej serii.
- Po zapisie panel zamyka się, fokus wraca do wejścia, widoczny jest komunikat
  z Otwórz. Pozostajemy na bieżącym ekranie. Dla wpisu poza filtrem pokazać
  informację i odnośnik, zamiast sprawiać wrażenie, że nic nie powstało.
  Capture na `/capture`, inline i triage zachowują właściwe im zakończenie.

## Kolejność wdrożenia

| Etap | Zakres i miejsca w kodzie | Warunek zakończenia |
| --- | --- | --- |
| 1. Wspólna obudowa na Działaniu | Wydzielić obudowę tworzenia z nagłówkiem, scroll-body i stopką na bazie `Modal.tsx`. W `QuickAdd.tsx` zastosować ją dla Działania i ograniczyć style do tej obudowy. Zachować ochronę szkicu/zapisu; sprawdzić fokus i visual viewport. | Działanie działa przy małej wysokości i klawiaturze; lokalne formularze jeszcze nie są masowo przełączane. Wspólny Modal nie psuje edycji ani wyszukiwania. |
| 2. Wszystkie wejścia Działania | Wspólne pola, model, walidacja i szkic dla `QuickAdd`, `StartPage`, `ProjectDetailPage` i `GoalDetailPage`; przeniesienie inline → szczegóły. Ustalić wspólny wynik zapisu i kontekst. | Te same wartości i wynik z każdego wejścia; odzyskiwanie wcześniejszych szkiców; termin niezależny od przypięcia. |
| 3. Cel, Projekt i Rutyna | Wydzielić formularze typów z `GoalsPage`, `ProjectsPage`, `RecurringActionForm` i QuickAdd, a wejścia podłączyć przez jeden kontrakt. Rozszerzyć żądanie o potrzebne wartości początkowe. Usunąć wybór innej implementacji przez szerokość dopiero po osiągnięciu zgodności opcji danego typu. | Mobile i desktop zachowują wszystkie funkcje; filtr kategorii działa identycznie; Rutyna ma bezpieczny częściowy sukces także po wznowieniu. |
| 4. Capture i Wiedza | `QuickCapture`, `CaptureComposer`, `KnowledgePage`, `ProjectDetailPage`, `KnowledgeDetailPage`, `ActionKnowledgeRelations` i `InboxPage`: wspólne pola, szkice, właściwy rodzaj i relacje. Triage zachowuje własną komendę końcową. | Tekstowa notatka działa wszędzie bez tytułu; Materiał otwiera Materiał; książki i relacje źródłowe pozostają poprawne; Capture ma jeden kontrakt. |
| 5. Pozostałe formularze i dopracowanie przejść | `ActionResultDialog`, postęp Celu, `WeeklyPlanPanel`, kategorie i szablony. Wspólne błędy, stany zapisu i typografia. Dokończyć animacje oraz sygnał pierwszego otwarcia. Usunąć dopiero zastąpione reguły CSS. | Wszystkie wejścia z tabeli mają zgodny standard; brak nakładających się okien i znikających błędów. |
| 6. Odbiór całości | Testy integracyjne, kontrola filtrów/paginacji i rzeczywiste urządzenia; przegląd nakładek przy obu kolejnościach ładowania CSS szczegółów. Uaktualnić statusy planów po wykonaniu. | Spełniona macierz odbioru poniżej i zapisane nowe dowody wizualne. |

Współdzielić pola i logikę typów przez niewielkie komponenty oraz adaptery
zapisu. Nie rozbudowywać QuickAdd o wszystkie lokalne wyjątki w jednym
monolitycznym komponencie. Capture, triage, zapis postępu i łączenie
istniejącego obiektu zachowują swoje operacje domenowe.

Pierwsze etapy mogą używać istniejących komend i modelu danych. Plan nie wymaga
nowej biblioteki formularzy ani animacji. Zmiana gwarancji ponawiania wymaga
wcześniejszej weryfikacji kontraktu danych; sama blokada przycisku nie zapewnia
idempotencji po utracie odpowiedzi sieciowej.

Zmiany wdrażać typami. Usuwanie poprzedniej ścieżki i jej CSS następuje dopiero
po potwierdzeniu zgodności pól i migracji szkiców. Pozostawić stare szkice jako
możliwe do odzyskania przez okres migracji. Przy wycofaniu wersji nie usuwać
nowych szkiców ani utworzonych obiektów. Nie nadpisywać zastanych zmian w
`polish.css`, `focus-detail.css` i `design-qa.md`.

## Kryteria odbioru

| Obszar | Scenariusze i oczekiwany wynik |
| --- | --- |
| Wejścia | Każdy wiersz macierzy wejść na telefonie i desktopie. Właściwy typ, kontekst i pełen zakres opcji; brak drugiej instancji edytora. |
| Klawiatura i geometria | 320 × 480, 390 × 844, 767/768 px i desktop 1440 px; iOS Safari/PWA i Android Chrome z prawdziwą klawiaturą. Widać edytowane pole i można dotrzeć do zapisu; przewija się tylko treść, bez poziomego overflow i pustej szczeliny nad klawiaturą. |
| Ciągłość | Otwórz/zamknij/wznów, zmień typ, rozwiń opcje, inline → pełny formularz, zmiana szerokości, długi polski tekst. Bez utraty tekstu, daty, powiązań, kursora i świadomej pozycji przewijania. |
| Szkice | Nowy/stary szkic, konflikt dwóch dawnych kluczy, awaria storage, zmiana Workspace i odświeżenie danych. Brak nadpisania lub przenikania kontekstów; lokalny szkic opisany jako lokalny. |
| Zapis | Wolna odpowiedź, podwójne wysłanie, kliknięcie X/Anuluj/tła, Escape w trakcie, błąd, sukces z błędem sprzątania i częściowy sukces Rutyny. Jeden rezultat operacji, zachowany tekst przy błędzie, ponowienie właściwego kroku. |
| Powiązania | Działanie w Celu i Projekcie, samodzielny wpis, niedostępny kontekst, książka w kilku Projektach, notatka ze źródłem. Brak sprzecznego Projektu/Celu ani niejawnej zmiany roli relacji. |
| Wynik | Nowy wpis od razu odnajdywalny; komunikat i Otwórz również przy filtrze, archiwum/koszu lub stronicowaniu wykluczającym wynik. Powrót do miejsca pracy bez utraty filtrów i scrolla. |
| Dostępność i ruch | Klawiatura, czytelny fokus, Tab/Shift+Tab, Escape, czytnik ekranu, opis błędu przy polu, reduced motion. Brak dekoracyjnych animacji konkurujących z wpisywaniem. |
| Regresje | Edycja Działania/Celu/Wiedzy, wyszukiwanie, eksport AI, propozycje AI i potwierdzenia nadal działają. Przejście na wspólną obudowę nie narzuca im pól ani zachowania tworzenia. |

Rozbudować istniejące testy zachowań przy migracji danego typu, zamiast
utrwalać osobne snapshoty starego i nowego formularza. Szczególnie wartościowe
są regresje równoważnych wejść mobile/desktop, notatki przy Działaniu,
przekazania szkicu inline oraz częściowego sukcesu po ponownym otwarciu.
JSDOM nie zastępuje kontroli klawiatury ani pomiaru płynności w przeglądarce.

## Decyzje produktowe do przyjęcia przy realizacji

1. Zachować rozróżnienie: Szybki zapis przechwytuje do Skrzynki,
   a kontekstowe Dodaj tworzy konkretny obiekt. Ujednolicić ich obsługę
   i wygląd bez dokładania klasyfikacji do Capture.
2. Po utworzeniu domyślnie pozostać na bieżącym ekranie, z jawnym Otwórz.
   To zastępuje obecne automatyczne przejście do nowego Celu na desktopie.
3. Zachować krótkie formularze inline w Celu i planie tygodnia. Ich rozwinięcie
   ma kontynuować tę samą pracę, zamiast otwierać niezależny szkic.

Są to rekomendowane wartości domyślne planu; nie wymagają wstrzymywania
przygotowania wspólnej obudowy ani migracji pól.

## Weryfikacja przeglądu

Sprawdzono aktywne wejścia, wywołania zapisu, obsługę szkiców, warunki mobile,
Modal, przejścia i kaskadę stylów w kodzie. Obejrzano zapisany zrzut
`docs/design/mobile-a-2026-10-29/new-action-390.png` jako referencję wariantu A.

Uruchomiono istniejące testy `QuickAdd`, `Modal`, `CaptureComposer`,
`App`, `App.regression`, `KnowledgeDetailPage`, `KnowledgePage` i `InboxPage`:
**8 plików, 112 testów zakończonych sukcesem**. Potwierdza to sprawdzane
zachowania w lokalnym środowisku testowym; nie jest odbiorem wizualnym.

Dostęp do lokalnych przeglądarek jest wyłączony w ustawieniach Work tej sesji.
Nie wykonano nowych prób na żywym UI, pomiarów czasu renderowania ani zapisów
w zewnętrznej bazie. Płynność, klawiatura telefonu i końcowy przepływ zapisu
w rzeczywistym środowisku pozostają warunkiem odbioru implementacji.

## Źródła w repozytorium

- [Bieżący model produktu](../../CONTEXT.md) i [kontrola wyglądu](../../design-qa.md).
- [AppShell i wybór wejścia](../../apps/web/src/components/AppShell.tsx), [QuickAdd](../../apps/web/src/components/QuickAdd.tsx), [Modal](../../apps/web/src/components/Modal.tsx), [FormTransition](../../apps/web/src/components/FormTransition.tsx).
- [Szybki zapis](../../apps/web/src/components/CaptureComposer.tsx), [szkice](../../apps/web/src/hooks/usePersistentDraft.ts), [notatka](../../apps/web/src/components/KnowledgeNoteFields.tsx), [normalizacja notatki](../../apps/web/src/domain/knowledgeNote.ts).
- [Rutyna](../../apps/web/src/components/RecurringActionForm.tsx), [Wiedza Działania](../../apps/web/src/components/ActionKnowledgeRelations.tsx), [rezultat](../../apps/web/src/components/ActionResultDialog.tsx), [plan tygodnia](../../apps/web/src/components/WeeklyPlanPanel.tsx).
- [Cel](../../apps/web/src/pages/GoalsPage.tsx), [Projekt](../../apps/web/src/pages/ProjectDetailPage.tsx), [Biblioteka](../../apps/web/src/pages/KnowledgePage.tsx), [porządkowanie Skrzynki](../../apps/web/src/pages/InboxPage.tsx).
- [Historyczny audyt Dodaj](./2026-09-09-add-complete-audit.md) i [plan Szybkiego zapisu](./2026-10-24-easy-capture-and-return-plan.md).
