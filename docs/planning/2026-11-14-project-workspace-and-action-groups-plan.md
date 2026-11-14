# Plan usprawnienia Projektu i grupowania Działań

Data: 14 listopada 2026. Status: oba wydania zaimplementowane; backend grup wdrożony do Supabase, frontend sprawdzony lokalnie.

## Realizacja pierwszego wydania

Wykonano stabilizację odświeżania, menu Dodaj, opis pod tytułem i pulpit
Projektu z pełną filtrowaną listą Działań. Zachowano szkice, bezpośrednie
wejścia do formularzy i model danych Celów. Kontrole końcowe: lint, typecheck,
83 pliki / 638 testów i build demo poprawne. Odbiór przeglądarkowy obejmuje
szerokości od 320 do 1920 px. Przyczyny migania, dowody i granice odbioru:
[raport pierwszego wydania](../design/project-workspace-2026-11-14/README.md).

## Realizacja drugiego wydania

Wdrożono Kategorie i Zadania nadrzędne, wspólne grupowanie Działań w Projekcie,
bezpieczne przenoszenie kroków, zgodność starych danych i szkiców oraz reguły
planu tygodnia i AI. Dwie migracje zastosowano w Supabase; pełne rekordy
istniejących Celów, Działań, kryteriów, postępu, relacji Wiedzy i Rutyn mają
identyczne sumy kontrolne przed i po. Przegląd AI działa jako wersja 19.
Interfejs zweryfikowano lokalnie. [Raport drugiego wydania](../design/action-groups-2026-11-14/README.md).

Poniższe ustalenia i opis stanu przed implementacją pozostają podstawą planu.

Celem zmian jest wygodna codzienna praca: szybkie dodawanie, stabilny zapis,
wykorzystanie szerokiego ekranu i porządkowanie Działań pod kategoriami albo
zadaniem nadrzędnym. Pierwsze wydanie obejmuje cztery poprawki interfejsu.
Drugie zmienia rolę obecnych Celów, zachowując istniejące dane i powiązania.

## Zakres i ustalenia

Plan obejmuje zgłoszenia z Projektu Command:

| Zgłoszenie | Zakres planu |
| --- | --- |
| Rozwijane menu po kliknięciu Dodaj w Projekcie | Menu wyboru rodzaju przy przycisku; wybór otwiera istniejący formularz. |
| Opis bezpośrednio pod tytułem | Widoczne pole opisu przed terminem, kontekstem i pozostałymi opcjami. |
| Lepszy układ na większych ekranach | Jednoczesna praca z Działaniami, grupami i Wiedzą w domyślnym widoku Projektu. |
| Miganie przy dodawaniu | Odtworzenie problemu i usunięcie potwierdzonej przyczyny bez osłabienia synchronizacji. |
| Cel jako kategoria lub zadanie nadrzędne | Jedna grupa Działań w dwóch odmianach: Kategoria oraz Zadanie nadrzędne. |

Użytkownik doprecyzował, że obecne Cele mają służyć bardziej jako kategorie,
np. UI/UX i Wydajność, albo jako jedno zadanie nadrzędne z Działaniami pod sobą.
Nie chodzi o dodanie drugiego, równoległego obowiązkowego systemu klasyfikacji.
„Grupy działań” to proponowana nazwa wspólna dla obu odmian.

Przyjmujemy, że menu zastępuje początkowy popup wyboru rodzaju. Pełny formularz
wybranego obiektu nadal otwiera się w obecnym panelu/dialogu.

## Stan przed implementacją

Poniższe zachowania potwierdzono w lokalnym kodzie 14 listopada:

- `ProjectDetailPage.tsx` wybiera jedną sekcję przez `view`; pełne listy
  Celów, Działań i Wiedzy są wzajemnie wykluczające.
- Desktopowy Przegląd ma już kolumny i komponenty `ProjectOverviewActions`
  oraz `ProjectOverviewContext`. Potrzebuje rozwinięcia w miejsce pracy,
  a nie ponownego dodania samych podsumowań.
- `useDesktopLayout.ts` rozpoznaje desktop od 1200 px. O układzie Projektu
  powinna decydować również szerokość treści po odjęciu nawigacji.
- `AppShell` obsługuje kontekstowe Dodaj i ładuje `QuickAdd` leniwie.
  Przycisk obecnie deklaruje `aria-haspopup="dialog"`.
- Opis Działania jest po terminie, wewnątrz „Opis i powiązania”. Dla innych
  typów opis jest zwykle zwijany; przy Materiale link poprzedza opis.
- `createAction` korzysta już z optymistycznej komendy. Po mutacjach store
  grupuje odświeżenia, a koordynator chroni przed starszymi odpowiedziami.
  Globalny stan ładowania korzysta z początkowego `isPending`.
- Wiedza Projektu łączy wynik zapytania z lokalnymi rekordami optymistycznymi.
  Zestaw identyfikatorów Wiedzy jest częścią klucza zapytania.
- Obecny Cel ma rezultat `outcome`, status osiągnięcia, kryteria i relację
  `goalId` używaną przez Działania. Plan tygodnia i przegląd AI korzystają
  z Celów. Kategorie Projektów grupują Projekty, a nie Działania.

Migania nie odtworzono w działającym UI. Odświeżenie, przejście ładowanego
panelu i animacja są hipotezami do sprawdzenia. Wcześniejszy odbiór dodawania
z 4 listopada nie dowodzi braku zgłoszonego problemu w obecnej wersji.

## Priorytety

### Najważniejsze

| Kolejność | Zmiana | Potrzebny zakres | Korzyść | Ryzyko |
| --- | --- | --- | --- | --- |
| 1 | Stabilny zapis bez migania | Reprodukcja, pomiar, poprawka właściwej warstwy, regresja odświeżenia | Ekran i świeżo dodany wpis pozostają stabilne | Ukrycie problemu animacją lub wyłączenie odświeżania mogłoby pozostawić nieaktualne dane |
| 2 | Menu Dodaj w Projekcie | Przycisk w AppShell, menu, kontekst i klawiatura | Szybszy wybór bez otwierania pośredniego dialogu | Utrata Projektu, szkicu lub fokusu między menu a formularzem |
| 3 | Opis pod tytułem | Wspólne formularze i ich kolejność | Nazwa i treść powstają razem | Wyższy formularz na telefonie; potrzebna osiągalna stopka |
| 4 | Wspólny widok na szerokim ekranie | Panele sekcji, układ, adresy i filtry | Mniej przełączania podczas codziennej pracy | Zbyt ciasne kolumny, powielone dane lub skok scrolla |

### Średni priorytet wdrożenia

| Kolejność | Zmiana | Potrzebny zakres | Korzyść | Ryzyko |
| --- | --- | --- | --- | --- |
| 5 | Cele jako grupy Działań | Reguły dwóch odmian, zapis, migracja, UI, plan tygodnia i AI | UI/UX lub Wydajność są naturalnymi miejscami na Działania | Zmiana semantyki może zafałszować historię, postęp i rekomendacje |

Etap 5 jest ważnym kierunkiem produktowym. Osobne wydanie wynika z szerszych
zależności i migracji; pierwsze cztery poprawki mogą dostarczyć korzyść wcześniej.

## Wydanie pierwsze

### Etap 1 Stabilne dodawanie

1. Odtworzyć dodawanie Działania, Celu i Wiedzy z Przeglądu oraz właściwej
   sekcji. Porównać pierwsze i kolejne otwarcie, moment zapisu i późniejszą
   synchronizację, w demo i środowisku testowym z backendem.
2. Nagrać przebieg przy normalnej oraz opóźnionej odpowiedzi. Sprawdzić,
   czy miga tło, panel, cała lista czy tylko nowy rekord. Zmierzyć montowania,
   zmiany stanu zapytań, kluczy, kolejności rekordów i pozycję przewinięcia.
3. Zależnie od wyniku poprawić przejście leniwie ładowanego formularza,
   montowanie komponentu, zachowanie danych podczas odświeżenia albo
   animację. Zmiana klucza zapytania Wiedzy zasługuje na osobne sprawdzenie.
4. Zachować optymistyczny zapis, wycofanie po jednoznacznym błędzie,
   idempotentne retry i ochronę przed spóźnionym odczytem. Stan odświeżania
   w tle nie może zastępować istniejącej zawartości pustym ekranem.

Odbiór: po zapisie nowy wpis pojawia się raz i nie znika przy synchronizacji;
tło pozostaje widoczne, filtry i scroll są zachowane, potwierdzenie jest jedno.
Błąd zachowuje szkic i pozwala bezpiecznie ponowić próbę. Wpis wykluczony przez
filtr ma dostępne Otwórz; nie znika bez wyjaśnienia.

### Etap 2 Menu Dodaj

- Nagłówkowe Dodaj w Projekcie otwiera menu zakotwiczone przy przycisku:
  Działanie, Cel oraz Notatka, Materiał i Decyzja. Po drugim wydaniu Cel
  zmieni się na Grupę działań. Czytelnia dodatkowo eksponuje Książkę.
- Jednoznaczne przyciski wewnątrz sekcji, np. Dodaj Działanie i Dodaj książkę,
  nadal otwierają właściwy formularz bez wyboru rodzaju.
- Menu przekazuje bieżący Projekt i dotychczasowy klucz szkicu właściwego
  typu. Wznowiony szkic zachowuje własne, jawnie widoczne powiązania.
- Wybór zamyka menu i otwiera jeden formularz. Otwarcie samego menu nie
  ustawia fokusu w polu tekstowym i nie uruchamia klawiatury ekranowej.
- Menu obsługuje strzałki, Enter, Escape, kliknięcie poza i powrót fokusu.
  Aktualizujemy semantykę przycisku na menu oraz powiązanie z listą opcji.
  Po zamknięciu formularza fokus wraca do trwałego przycisku Dodaj.
- Menu mieści się w viewport także przy dolnej krawędzi i na telefonie.
  Skróty kontekstowego Dodaj korzystają z tego samego zachowania; globalny
  Szybki zapis zachowuje obecny przepływ.

Odbiór: każdy wybór otwiera właściwy typ z widocznym Projektem; nie pojawia
się pośredni dialog wyboru ani drugi formularz. Czytelnia zachowuje możliwość
dodania i połączenia istniejącej książki.

### Etap 3 Opis bezpośrednio pod tytułem

- W Działaniu kolejność to nazwa → widoczny, opcjonalny opis → termin →
  powiązania i pozostałe opcje. Powiązania otrzymują osobne rozwinięcie.
- W Celu, Projekcie, Rutynie, Materiale i Decyzji pole opisu/uzasadnienia
  umieszczamy pod nazwą, przed linkiem, harmonogramem i ustawieniami.
  Zachowujemy obecne reguły wymaganej treści dla poszczególnych typów.
- Pole opisu ma niewielką wysokość początkową i rośnie wraz z treścią.
  Korzysta z tego samego modelu szkicu, bez dodatkowej kopii stanu.
- Krótka Notatka pozostaje oparta na treści z opcjonalnym tytułem. Szybki
  zapis pozostaje pojedynczym polem. Inline w Celu zachowuje szybkie
  dodanie, a rozwinięcie panelu kontynuuje ten sam szkic.

Odbiór: po nazwie następne pole edycji to opis; jest widoczne bez rozwijania.
Wznowienie szkicu zachowuje tekst i podziały linii. Stopka zapisu pozostaje
osiągalna na telefonie z klawiaturą.

### Etap 4 Projekt wykorzystujący szerokość

Domyślny Przegląd rozwijamy w pulpit pracy. Główna kolumna pokazuje Działania
z obsługą statusu i filtrem. Obok znajdują się grupy/obecne Cele oraz Wiedza
z możliwością otwarcia wpisu i dodawania. Rozwijamy istniejące komponenty
Przeglądu; sekcje używają wspólnych reguł filtrowania z pełnymi listami.

| Dostępne miejsce | Docelowe zachowanie |
| --- | --- |
| Telefon i ciasna treść | Jedna sekcja naraz, dotychczasowa nawigacja zakładkami. |
| Miejsce na dwie czytelne kolumny | Działania jako główna lista; grupy i Wiedza jedna pod drugą w bocznej kolumnie. |
| Miejsce na trzy czytelne kolumny | Działania, grupy i Wiedza widoczne obok siebie. |

Progi dobrać do szerokości kontenera i czytelności kart; sprawdzić widoki
1024, 1200, 1440 i 1920 px oraz powiększenie do 200%. Nie wystarczy sam
warunek szerokości całego okna. Na desktopie domyślny pulpit nie wymaga
wybierania sekcji, aby pracować z trzema rodzajami danych. Pełne listy
pozostają dostępne przez Pokaż wszystkie; adresy `?view=...` nadal otwierają
odpowiednią sekcję. Kontrolki widoku łączonego nie udają zakładek z jednym panelem.

Unikamy osobnych scrollbarów w każdej kolumnie. Długie zestawy boczne mają
czytelny limit i Pokaż wszystkie. Czytelnia eksponuje książki, a Projekt
w Archiwum lub Koszu zachowuje dotychczasowe reguły dostępnych operacji.

Odbiór: na szerokim ekranie można dodać Działanie, zmienić jego status,
sprawdzić grupę i otworzyć Wiedzę bez zmiany zakładki. Powrót ze szczegółu
odtwarza filtry, miejsce i fokus. Zwężenie okna nie usuwa szkicu ani filtrów.

## Wydanie drugie Cele jako grupy Działań

### Model produktowy

Jedna grupa ma jedną z dwóch odmian. Proponowany domyślny wybór przy tworzeniu
w Projekcie to Kategoria; Zadanie nadrzędne pozostaje łatwo dostępne.

| Reguła | Kategoria | Zadanie nadrzędne |
| --- | --- | --- |
| Przykład | UI/UX, Wydajność | Przygotować nowy ekran Projektu |
| Znaczenie | Stały temat porządkowania Działań | Skończona praca realizowana przez Działania |
| Wymagane pola | Nazwa | Nazwa; opis rezultatu i kryteria opcjonalne |
| Zamknięcie | Archiwizacja, bez osiągania rezultatu | Jawne ukończenie lub porzucenie |
| Ukończenie wszystkich Działań | Kategoria pozostaje dostępna na nowe wpisy | Sugestia ukończenia, bez automatycznego zamknięcia |
| Postęp | Liczba otwartych i ukończonych Działań, bez procentu sukcesu kategorii | Liczniki Działań i opcjonalne kryteria rezultatu |

Projekt zawiera grupy, grupa zawiera Działania. W pierwszej wersji Działanie
ma najwyżej jedną grupę i może pozostać Bez grupy, aby szybki zapis nie wymagał
klasyfikacji. Dodaj wewnątrz grupy przypisuje ją automatycznie. Widok Działań
Projektu pozwala grupować po grupie i przenosić Działanie przez wybór grupy.
Drag and drop oraz wielopoziomowe drzewa pozostają poza pierwszą wersją.

Obie odmiany mogą współistnieć w Projekcie. Działanie może należeć do UI/UX
albo do zadania nadrzędnego; nakładanie obu wymiarów jednocześnie wymagałoby
osobnego modelu i nie jest przyjętym zakresem. Kategorie Projektów nadal
porządkują Projekty i mają odrębną etykietę w formularzach.

### Etap 5A Zapis i zgodność

1. Zapisać nową definicję w decyzji domenowej. `CONTEXT.md` obecnie określa
   Cel jako rezultat — podczas wdrożenia trzeba zaktualizować ten kontrakt.
2. Rozszerzyć istniejący rekord Celu o jawne rozróżnienie Kategoria/Zadanie
   nadrzędne. Techniczny identyfikator i relacja `goalId` pozostają stabilne;
   nie kopiować Działań do drugiego kontenera. Nowe pole jest niezależne od
   obecnego `kind` określającego rodzaj Celu.
3. Istniejące Cele zachować jako Zadania nadrzędne, z tymi samymi ID,
   statusami, kryteriami, Wiedzą, Rutynami i historią. Brak nowego pola
   w starym snapshotcie oznacza Zadanie nadrzędne. Kategorie powstają przez
   jawny wybór; nie zgadywać typu z nazwy UI/UX albo Wydajność.
4. Kategorie nie wymagają `outcome`. Sprawdzić istniejące ograniczenia tabeli,
   komendy, RPC i walidację; usunąć wymóg dla tej odmiany w pełnym przepływie.
   Nie generować sztucznego rezultatu z tytułu. Ustalić obsługę istniejących
   statusów bez utożsamiania ukończenia z archiwizacją.
5. Przygotować addytywną migrację i zgodne odczyty/zapisy demo, backendu,
   lokalnych snapshotów, eksportów i szkiców. Zachować izolację Workspace
   i kontrolę zgodności Projektu Działania z Projektem grupy.
6. Aktywne zadanie bez kryteriów i historii rezultatu można jawnie zmienić
   w kategorię po pokazaniu skutków. Konwersję pozostałych rekordów odłożyć;
   formularz wyjaśnia zachowane dane i warunek blokady. Nie kasować historii.

Odbiór: migracja zachowuje liczbę i identyfikatory obiektów, powiązania oraz
historię; starsze snapshoty nadal się otwierają. Testy komend i bazy odrzucają
powiązania między Workspace'ami oraz sprzeczny kontekst Projektu.

### Etap 5B Pełny przepływ użytkownika

- Projekt i lista globalna używają wspólnej nazwy Grupy działań z oznaczeniem
  odmiany. Formularz pokazuje Nazwę i Opis, a opcje rezultatu dotyczą zadania.
- Szczegół grupy zaczyna się od jej Działań i Dodaj Działanie. Dla kategorii
  wynik, kryteria i osiągnięcie nie dominują w interfejsie.
- Zaktualizować selecty, filtry, wyszukiwanie, triage, etykiety kontekstu,
  szablony, szkice i Czytelnię. Istniejące adresy Celów pozostają działające.
- Plan tygodnia może wybierać grupę jako zakres Działań. Kategoria nie dostaje
  terminu ukończenia ani oceny braku postępu wyłącznie z powodu swojej trwałości.
- AI, sygnały Projektu i eksport kontekstu rozróżniają stały temat od zadania.
  Zaktualizować kontrakty wejścia, prompty, walidację odpowiedzi i wersję cache.
  Stare analizy pozostają historią; nowe nie oceniają kategorii jak rezultatu.
- Następne Działanie pozostaje opcjonalnym wyróżnieniem w grupie; przynależność
  do kategorii sama nie narzuca kolejności ani terminu Działania.
- Archiwizacja grupy zachowuje Działania i powiązaną Wiedzę. Sprawdzić ich
  widoczność na globalnej liście, Starcie i w Projekcie; nie wprowadzać
  kaskadowego ukończenia lub ukrycia przez samą zmianę odmiany.

Odbiór: można utworzyć UI/UX, dodać dwa Działania i ukończyć oba, a następnie
dodać trzecie do tej samej kategorii. Można też utworzyć zadanie nadrzędne,
ukończyć jego Działania i jawnie zamknąć całość. Istniejący Cel zachowuje
historię i nadal działa po migracji, również w planie tygodnia i przez stary URL.

## Mapa implementacji i weryfikacji

| Obszar | Główne pliki | Weryfikacja |
| --- | --- | --- |
| Menu | `AppShell.tsx`, `ProjectDetailPage.tsx`, `appQuickAddRequest.ts` | Typ, Projekt, szkic, klawiatura, fokus, Czytelnia |
| Opis | `QuickAdd.tsx`, `ActionCreationFields.tsx`, `creation-form.css` | Kolejność pól, wznowienie, Notatka, wymagane uzasadnienie |
| Układ | `ProjectDetailPage.tsx`, `ProjectOverview.tsx`, `desktop.css`, `useDesktopLayout.ts` | Szerokości, filtry, historia, nawigacja, brak zdublowanych formularzy |
| Miganie | `AppShell.tsx`, `FormTransition.tsx`, `store.tsx`, `workspaceMutationCoordinator.ts`, `useProjectKnowledgeItems.ts` | Właściwy zakres wybrać dopiero po reprodukcji; wolny zapis, błędy, spóźniony odczyt |
| Grupy | `types.ts`, `commands.ts`, store, repozytoria, formularze i strony Celów, migracje | Zgodność danych, odmiany, relacje, szkice, RLS |
| Funkcje zależne | `projectModule.ts`, `weeklyPlan.ts`, przegląd AI, `packages/ai-context` | Kategorie bez fałszywych ocen rezultatu i bez zmiany zakresu danych |

Ścieżki plików źródłowych powyżej odnoszą się do `apps/web/src`, chyba że
wskazano inny katalog. Rozszerzyć istniejące testy `QuickAdd.test.tsx`,
`DesktopWorkspace.test.tsx`, `AppRouteLoading.test.tsx`, `store.test.tsx`
i `workspaceMutationCoordinator.test.ts`, zamiast tworzyć równoległy zestaw.

Dla każdego wydania uruchomić lint, typecheck, testy i build demo zgodnie
z zasadami repozytorium. Testy UI nie zastępują nagrania reprodukcji i odbioru
wizualnego. Odbiór obejmuje 320/390 px z klawiaturą ekranową, 768 px oraz
desktop 1024/1200/1440/1920 px, długie nazwy, pusty i duży Projekt,
reduced motion, powiększenie 200%, sukces, błąd i ponowienie.

## Kolejność wdrażania i wycofanie

1. Reprodukcja migania i poprawka z regresją.
2. Menu i opis jako jeden spójny przepływ tworzenia.
3. Szerszy pulpit Projektu i odbiór pierwszego wydania.
4. Decyzja domenowa dwóch odmian grup, migracja i zgodność odczytu/zapisu.
5. Formularze, listy, szczegóły, plan tygodnia i AI; odbiór drugiego wydania.

Etapy menu i opisu można przygotować niezależnie od diagnozy migania, ale
odbiór wykonujemy razem. Migracja grup poprzedza włączenie ich tworzenia.
Na środowisku testowym sprawdzić pełne przepływy z rzeczywistym zapisem;
wdrożenie produkcyjne stanowi osobny krok wykonawczy.

Poprawki interfejsu mają dać się wycofać niezależnie od modelu grup. Po
utworzeniu kategorii nie wracać do starego klienta, który interpretuje je
jako Cele do osiągnięcia. W razie problemu wstrzymać tworzenie kategorii,
zachować zgodny odczyt i poprawić nową wersję; nie usuwać kolumn ani danych.

## Ustalenia do sprawdzenia podczas odbioru

- Czy nazwa Grupy działań jest zrozumiała i czy Kategoria jako domyślny wybór
  odpowiada codziennej pracy użytkownika? Przykłady odbioru: UI/UX i Wydajność.
- Czy Działanie ma zwykle jedną grupę, czy potrzebuje równocześnie kategorii
  i zadania nadrzędnego? Wersja pierwsza grup zakłada jeden wymiar.
- Czy dwie kolumny wystarczają w najczęściej używanym oknie? Trzy kolumny
  włączamy dopiero, gdy nazwy i kontrolki pozostają czytelne.

Te punkty mają proponowane wartości powyżej. Pierwotny plan oparto na odczycie
kodu i istniejącej dokumentacji. Weryfikację wykonanego pierwszego wydania
opisuje raport realizacji; drugie wydanie ukończono, a jego odbiór opisuje raport poniżej.

## Powiązane dokumenty

- [Spójne dodawanie](./2026-11-03-creation-flows-consistency-plan.md)
- [Odbiór formularzy z 4 listopada](../design/creation-flows-2026-11-04/README.md)
- [Dotychczasowy model Projektów i Celów](./project-centered-hierarchy.md)
- [Obecny język domenowy](../../CONTEXT.md)
