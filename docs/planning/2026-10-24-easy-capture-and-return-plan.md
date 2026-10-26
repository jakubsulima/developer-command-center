# Plan szybkiego zapisu i regularnego powrotu do Command

Data: 24 października 2026. Status: główny zakres zaimplementowany lokalnie; odbiór push na iPhonie i wdrożenie produkcyjne pozostają do wykonania. Główne urządzenie: iPhone.

Użytkownik wskazał dwa powody nieregularnego korzystania: zapomina otworzyć aplikację, a zapis bywa czasochłonny. Najważniejsze zmiany to zapis jednej treści bez klasyfikowania, łatwe wejście z ekranu początkowego telefonu i jedno dobrowolne przypomnienie. Start ma pomagać podjąć pracę również po przerwie, a zapisane treści mają pozostawać użyteczne bez obowiązku codziennego porządkowania.

Plan zastępuje wcześniejszą propozycję, aby pierwszy kontakt obowiązkowo prowadził przez Skrzynkę, przetworzenie i ukończenie Działania. Zachowuje model Projektów, Celów, Działań i Wiedzy. Nie wymaga wprowadzania kolejnego rodzaju danych ani automatycznej klasyfikacji przez AI.

## Bieżące możliwości i ograniczenia

| Obszar | Stan w lokalnym kodzie | Konsekwencja |
| --- | --- | --- |
| Capture | `CaptureComposer` zapisuje tekst lub link, rozpoznaje pełny adres i przechowuje szkic. Nadal pokazuje wybór Tekst lub Link. | Uprościć istniejący komponent zamiast tworzyć drugi mechanizm zapisu. |
| Globalne dodawanie | `QuickAdd` ma sześć trybów; bez jawnego żądania otwiera wybór typu. Przycisk powłoki może zmieniać znaczenie zależnie od strony. | Oddzielić stały Szybki zapis od przycisków tworzących konkretne obiekty. |
| Ponowienie zapisu | Zdalny `capture_item` przyjmuje klucz idempotencji, ale `store.capture` generuje nowy UUID przy każdym wywołaniu i zwraca `void`. | Utrwalać identyfikator próby w szkicu i zwracać potwierdzony wpis, aby retry, Cofnij i Otwórz wskazywały właściwe dane. |
| Wyszukiwanie | Globalne wyniki obejmują Skrzynkę. | Oprzeć odnajdywanie luźnych wpisów na istniejącej funkcji; sprawdzić kompletność wyników z serwera. |
| Skrzynka | Status jest filtrowany po pobraniu strony. Dalsze pobieranie zależy od niepustej listy widocznych wpisów. AI i Przetwórz otwierają ten sam pierwszy krok. | Naprawić dostęp do starszych wpisów i usunąć redundantny przycisk. |
| Start | Wprowadzenie i rekomendacja mogą poprzedzać Na dziś; istnieje osobny panel AI. | Ograniczyć elementy poprzedzające pracę i zrezygnować z wymuszonego wieloetapowego wprowadzenia. |
| iPhone | Manifest PWA ma tryb standalone i `start_url: /`. Brak osobnej trasy szybkiego zapisu i implementacji Web Push w sprawdzonym kodzie. | Skrót, obsługa otwarcia i przypomnienia wymagają odrębnych przyrostów oraz odbioru na telefonie. |
| Offline | Są szkice lokalne i cache plików aplikacji; istnieje wcześniejszy plan kolejki offline. | Szkic nie oznacza wpisu wysłanego do konta. Nie obiecywać pełnego zapisu offline przed wdrożeniem kolejki. |

Stan potwierdzono przez analizę bieżącego drzewa roboczego, wraz z wcześniejszymi lokalnymi zmianami. Zrzuty z audytu 4 października są materiałem pomocniczym. Nie potwierdzono tych przepływów na aktualnym wdrożeniu ani iPhonie.

## Co usunąć i co przenieść

| Element | Decyzja | Co go zastąpi | Ryzyko i zabezpieczenie |
| --- | --- | --- | --- |
| Sześć typów przed szybkim zapisem | Usunąć z domyślnej ścieżki | Jedno pole i Zapisz; tworzenie konkretnych obiektów dostępne osobno | Osoby przyzwyczajone do dodawania Działania potrzebują widocznego Dodaj działanie na odpowiednich ekranach. |
| Przełącznik Tekst lub Link | Usunąć z Capture | Istniejące rozpoznawanie pełnego URL | Tekst zawierający link pozostaje tekstem; nie odrzucać całej myśli z powodu niepełnego adresu. |
| Obowiązkowe wybieranie Projektu, Celu i terminu przy zapisie myśli | Usunąć z pierwszego kroku | Globalny wpis w Skrzynce, opcjonalne uporządkowanie po zapisie | Nie dopisywać ukrytych relacji wynikających z ostatnio odwiedzonej strony. |
| Wprowadzenie Przechwyć → Przetwórz → Ukończ | Zastąpić | Pierwszy zapis lub pierwsze Działanie jako samodzielny sukces | Nie uzależniać zakończenia wprowadzenia od ukończenia zadania. |
| Osobny przycisk AI obok Przetwórz | Usunąć | Pomoc AI wewnątrz porządkowania, uruchamiana na życzenie | Zachować dostęp do istniejącej funkcji i podgląd przed zmianami. |
| Rozbudowany panel AI na Starcie | Zwinąć do pomocniczej akcji | Pomóż wybrać następny krok | Nie wykonywać analizy automatycznie po każdym wejściu. |
| Powtarzające się etykiety, np. Plan dnia i Na dziś, Jedna decyzja, bez touru modułów | Usunąć | Krótkie nagłówki opisujące czynność | Zachować informacje potrzebne do zrozumienia zapisu i błędów. |
| Licznik Skrzynki jako stały sygnał obowiązku | Ograniczyć do widoku Skrzynki | Neutralne Ostatnie zapisy i opcjonalne porządkowanie | Liczbę wszystkich wpisów pokazywać tylko ze źródła obejmującego pełny zbiór. |
| Wiele wariantów formularza tej samej czynności | Stopniowo scalić | Wspólne pola i reguły wymaganych danych | Usuwać stare warianty dopiero po migracji szkiców i sprawdzeniu wszystkich miejsc wejścia. |

Nie usuwać danych, Skrzynki, osobnych Celów, Rutyn ani Biblioteki. Przenoszenie Rutyn w nawigacji ma średni priorytet i nie jest warunkiem pierwszego wydania. Nie dodawać streaków, dziennych norm wpisów, punktów ani obowiązku zerowania Skrzynki.

## Docelowe przepływy

### Szybki zapis z dowolnego miejsca

Stały przycisk Szybki zapis w powłoce i osobna trasa `/capture` prowadzą do tego samego formularza. Globalny skrót klawiaturowy uruchamia tę samą czynność. Na telefonie etykieta centralnego przycisku może brzmieć Zapisz, z pełną dostępną nazwą Szybki zapis.

1. Użytkownik otwiera zapis i widzi pole „Co chcesz zapamiętać lub zrobić?”.
2. Wpisuje lub wkleja treść. Nie wybiera typu ani miejsca.
3. Naciska Zapisz. Pełna treść trafia do istniejącej Skrzynki.
4. Otrzymuje „Zapisano” oraz opcjonalne Otwórz, Uporządkuj i Cofnij. Nie otwiera się następny formularz.

Przy otwarciu w aplikacji zapis wraca do poprzedniego kontekstu. Osobna trasa po zapisie pozostaje na krótkim potwierdzeniu z możliwością zapisania kolejnej myśli; nie przekierowuje automatycznie na dashboard. Formularz ma jedną główną akcję, a przyciski po zapisie pozostają drugorzędne.

Ważne reguły: zapis nie tworzy automatycznie Działania, daty ani przypięcia na dziś. Przy wolnej sieci treść zostaje widoczna. Błąd i niepewny wynik zachowują szkic oraz ten sam identyfikator próby. Cofnij odwracalnie odrzuca właśnie zapisany wpis; późniejsza zmiana wpisu wymaga kontroli konfliktu, aby cofnięcie nie ukryło już przetworzonego źródła bez wyjaśnienia.

### Dodawanie w Projekcie lub Celu

Przyciski Dodaj działanie, Dodaj notatkę i Dodaj materiał zachowują konkretne znaczenie. Projekt lub Cel wynika z miejsca wejścia i jest widoczny jako mała etykieta. Nie trzeba wybierać go ponownie. Globalny Szybki zapis nadal zapisuje neutralnie do Skrzynki.

Działanie wymaga nazwy; opis i powiązania są dodatkowe. Notatka wymaga treści, a tytuł korzysta z istniejącej reguły automatycznego nadawania. Pierwsza wersja nie rozbudowuje surowego wpisu Skrzynki o relacje do Projektu. Takie rozszerzenie wymagałoby osobnego kontraktu danych; proste kontekstowe zapisy korzystają z już istniejących obiektów.

W Działaniu pokazać skróty Dziś, Jutro i Bez daty oraz wybór innej daty. Domyślnie brak daty, poza jawnym Dodaj na dziś. Przypięcie jest opcją dodatkową „Pokazuj na Starcie niezależnie od daty”. Przy przełożeniu przypiętego Działania poza dziś pokazać informację, że przypięcie nadal obowiązuje, wraz z akcją Odepnij. Nie zmieniać po cichu istniejących dat ani przypięć.

### Wejście z iPhone’a

Po pierwszym udanym zapisie można pokazać jednorazową, możliwą do odrzucenia propozycję „Dodaj szybki zapis do ekranu początkowego”. Instrukcja pozostaje później w Ustawieniach. Apple pozwala dodać aplikację webową oraz osobny skrót do ekranu początkowego. [Aplikacja webowa](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios), [skrót na ekranie początkowym](https://support.apple.com/en-ge/guide/shortcuts/apd735880972/ios).

Podstawowy wariant: istniejąca ikona Command otwiera Start, na którym Szybki zapis jest od razu dostępny. Dodatkowy skrót „Zapisz w Command” otwiera dokładny adres `/capture`. Sprawdzić rzeczywisty kontekst otwarcia i sesję: otwarcie URL przez Skróty nie jest obietnicą użycia istniejącego okna PWA. Nie zmieniać globalnego `start_url` ani tożsamości istniejącej instalacji tylko po to, by utworzyć drugi punkt wejścia.

Trasa zapisu musi zachować adres powrotu przez logowanie. Do działania potrzebuje sesji i wybranej przestrzeni, ale nie powinna czekać na pobranie list Projektów, Celów, metryk i AI. Oddzielenie tego ładowania trzeba zaprojektować bez pomijania autoryzacji. Fokus i klawiaturę sprawdzić na iPhonie; gdy system nie otwiera klawiatury automatycznie, pole musi być dostępne jednym dotknięciem. Zapis pozostaje widoczny nad klawiaturą, z uwzględnieniem bezpiecznych obszarów ekranu.

Udostępnianie z Safari jest późniejszym rozszerzeniem. Apple udostępnia skróty w arkuszu udostępniania, ale nie potwierdza to gotowej integracji Command. Najpierw prototyp odbioru tekstu i URL, zachowania przy logowaniu oraz podglądu przed zapisem. Nie wpisywać prywatnej treści ani tokenów do parametrów zapytań, logów czy analityki. Pierwsze wydanie korzysta ze zwykłego wklejania. [Skrót uruchamiany z innej aplikacji](https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios).

### Start i powrót po przerwie

Kolejność na telefonie: kompaktowe wejście do Szybkiego zapisu, Na dziś, a niżej jedno pomocnicze Wróć do pracy i zwinięte pozostałe informacje. Pusty Start oferuje Dodaj działanie na dziś oraz zapis myśli, bez instruktażu wymagającego przejścia przez kilka modułów.

Po przerwie nadal działa ten sam układ, bez dodatkowego kreatora powrotu. Zaległe Działania dostają osobną zwijaną grupę z prawdziwą liczbą i linkiem do listy; nie są automatycznie przekładane, kończone ani odpinane. Wymagająca decyzji blokada ma krótki widoczny sygnał. Najważniejsze teraz nie powtarza dużą kartą Działania widocznego tuż obok.

Wróć do pracy wskazuje ostatnio otwarte, nadal dostępne Działanie, Projekt lub materiał. To skrót nawigacyjny, nie nowy system priorytetów. Historia początkowo jest lokalna, rozdzielona według konta i przestrzeni; brak historii lub błąd jej odczytu nie blokuje Startu. Nie wyświetlać kolejnej zachęty do przeglądu tylko dlatego, że użytkownik długo nie wracał.

### Odnajdywanie i porządkowanie zapisów

Surowy wpis musi być czytelny i wyszukiwalny bez przetwarzania. Wynik wyszukiwania otwiera podgląd treści; porządkowanie jest świadomą osobną akcją. Po zapisaniu można wrócić do wpisu przez potwierdzenie lub Ostatnie zapisy w Skrzynce.

Naprawić filtrowanie statusu przed paginacją i dostęp do starszych wyników również wtedy, gdy bieżąca strona nie zawiera pasujących wpisów. Pusty stan odróżnia brak danych od ładowania i błędu. Liczniki nie mogą udawać liczby wszystkich rekordów na podstawie pierwszej strony.

Porządkowanie zaczyna się od podglądu źródła. Główne opcje: Działanie, Notatka i Materiał; Cel oraz pomoc AI pod Więcej. Istniejące tekst i URL wypełniają formularz. Po udanym zapisie dostępne są Zakończ i Następny. Opcjonalne „Uporządkuj 3 wpisy” jest małą sesją uruchamianą przez użytkownika, bez automatycznego startu i bez traktowania odłożenia jako przetworzenia. Oryginał oraz istniejące relacje pozostają zachowane.

### Przypomnienie o aplikacji

Ustawienie domyślnie wyłączone. Użytkownik wybiera dni, godzinę i strefę oraz cel przypomnienia: Szybki zapis lub Wybierz działanie. W pierwszej wersji jeden harmonogram i jedno wybrane urządzenie. Przykładowy tekst: „Masz coś do zapisania? Zajmie chwilę”. Bez szczegółów prywatnych Projektów na ekranie blokady, liczby zaległości i przypomnień nadrabianych po przerwie.

Web Push na iPhonie wymaga aplikacji dodanej do ekranu początkowego i zgody wywołanej świadomą akcją użytkownika; wsparcie Apple opisuje od iOS 16.4. Przed włączeniem sprawdzić funkcje dostępne na urządzeniu. Sam manifest i otwarta karta nie realizują harmonogramu. Potrzebne są subskrypcja, obsługa powiadomień w service workerze i wysyłka z serwera. [WebKit o Web Push](https://webkit.org/blog/13878/), [Apple o wysyłaniu powiadomień](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

Plan danych: preferencja przypomnienia przypisana do użytkownika i przestrzeni, subskrypcja wybranego urządzenia oraz rejestr prób wysyłki. Unikalny klucz harmonogramu, lokalnej daty i urządzenia ogranicza ponowne wysłanie; retry nie może obiecywać niemożliwej do zagwarantowania dostawy dokładnie raz. Ustalić strefę, reguły zmiany czasu, krótki czas ważności i koniec okna retry, aby spóźnione przypomnienie nie wracało następnego dnia. Sukces usługi push nie oznacza przeczytania przez użytkownika.

Wylogowanie odłącza urządzenie od przypomnień konta. Odmowa lub cofnięcie zgody wyświetla stan Wyłączone, bez ponawiania systemowego pytania przy każdym wejściu. Wyłączenie harmonogramu zatrzymuje przyszłe wysyłki; niesprawne subskrypcje są wygaszane. Kliknięcie prowadzi do właściwej trasy także po wygaśnięciu sesji. Tryb Skupienie i ustawienia systemu mogą zmienić moment prezentacji; odbiór obejmuje rzeczywisty iPhone.

Przed budową wysyłki można sprawdzić przydatność rytuału przez ręcznie ustawione systemowe przypomnienie z linkiem. To osobna opcja pilotażu, nie zastępstwo gotowej funkcji. Ten plan nie ustawia żadnych przypomnień.

## Kolejność wdrożenia i zależności

| Etap | Priorytet i zakres | Główne miejsca zmian | Warunek odbioru |
| --- | --- | --- | --- |
| 1 | Najważniejsze: jeden Capture, stały przycisk, retry i potwierdzenie | `CaptureComposer`, `QuickAdd`, `AppShell`, `appQuickAddRequest`, `store-context`, `store`, `capture`, `usePersistentDraft`, adapter zapisu | Tekst i link zapisują się bez klasyfikacji. Ponowienie po timeoutcie nie tworzy drugiego wpisu. Stare szkice pozostają dostępne. |
| 2 | Najważniejsze: `/capture`, skrót iPhone, powrót po logowaniu | `App`, `AuthRoot`, ładowanie Store, PWA i instrukcja w Ustawieniach | Z zimnego i ciepłego startu można zapisać treść; przyciski nie chowają się za klawiaturą. |
| 3 | Najważniejsze: uproszczony Start i odnajdywanie wpisów | `StartPage`, `homeSummary`, `AIStartGuidance`, `firstFlow`, `GlobalSearch`, `InboxPage`, odczyty stron | Wpis jest dostępny bez triage, starsze wyniki nie znikają, powrót po przerwie nie wymaga kreatora. |
| 4 | Najważniejsze dla zapominania: dobrowolne przypomnienie | Ustawienia, subskrypcje, service worker, harmonogram wysyłki, routing po kliknięciu | Zgoda, wysyłka przy zamkniętej aplikacji, otwarcie właściwego widoku i wyłączenie sprawdzone na iPhonie. Wymaga etapu 2. |
| 5 | Średnie: wspólne formularze, porządkowanie małymi porcjami, daty, filtry i powroty | `QuickAdd`, formularze stron, `InboxPage`, `ActionsPage`, `savedActionViews`, `ProjectDetailPage`, `ActionFeedback` | Spójne wymagane pola, W toku + Zaległe, zachowany kontekst powrotu, przewidywalne przypięcie i cofanie. |
| 6 | Warunkowe: kolejka offline i udostępnianie z Safari | Zakres istniejącego planu offline, bramka Auth, repozytorium kolejki, prototyp Skrótu | Offline → zamknięcie → otwarcie → online zachowuje treść i tworzy jeden wpis. Udostępnianie odbiera prawdziwą treść z aplikacji źródłowej. |

Etap 4 można rozwijać po etapie 2 niezależnie od większego porządkowania interfejsu. Błędy filtrów i nawigacji z etapu 5 mogą wejść wcześniej jako małe poprawki. Offline awansuje, jeśli próby na telefonie pokażą, że sieć rzeczywiście przerywa zapisy.

Wskazane moduły znajdują się w `apps/web/src`, konfiguracja PWA w `apps/web/vite.config.ts`. Nowe trasy, historia otwarć i infrastruktura przypomnień są propozycjami, nie istniejącymi API.

## Dane i bezpieczne przejście

Pierwszy etap zachowuje tabelę Skrzynki i jej typy. `capture` przyjmuje stabilny klucz ze szkicu i zwraca potwierdzony rekord lub jego ID. Adapter uzgadnia wynik serwera ze stanem optymistycznym; po ponowieniu nie zostawia dwóch lokalnych wpisów. Nowy identyfikator powstaje po rozstrzygnięciu poprzedniego zapisu. Przy niepewnym wyniku nie wolno użyć tego samego klucza do zmienionej treści.

Istniejących szkiców Quick Add nie konwertować bezgłośnie na Capture. Zachować je pod dotychczasowym kontekstem i zapewnić „Masz szkic Działania — Otwórz”. Zamykanie i przełączanie aplikacji wymaga opróżnienia bufora zapisu szkicu, z czytelną obsługą błędu pamięci. Sukces zapisu do konta i błąd usunięcia lokalnego szkicu muszą mieć różne komunikaty.

Szkic jest lokalny. Przed etapem offline błąd sieci oznacza „Nie wysłano. Treść pozostała na tym urządzeniu”, o ile zapis lokalny rzeczywiście się udał. W etapie offline potwierdzenie lokalne wymaga udanego zapisu do trwałej kolejki przed wyczyszczeniem pola. Kolejka ma właściciela, przestrzeń, stabilny identyfikator i stany synchronizacji; zmiana konta nie może wysłać cudzych wpisów. Odmowa pamięci pozwala skopiować treść.

Nowe dane przypomnień wymagają migracji, kontroli własności i izolacji przestrzeni, eksportu preferencji oraz usuwania subskrypcji. Klucze wysyłki pozostają po stronie serwera. Przed implementacją dobrać mechanizm harmonogramu do istniejącego wdrożenia i aktualnej dokumentacji Supabase. Nie dodawać osobnego dostawcy ani infrastruktury AI do prostego przypomnienia.

Wdrażać etapami, z możliwością przywrócenia poprzedniego wejścia do formularzy. Wycofanie UI nie usuwa nowych wpisów ani szkiców. Przypomnienia mają osobny wyłącznik wysyłki. Kolejki offline nie wyłączać przez skasowanie niewysłanych danych.

## Odbiór i ocena efektu

Testy techniczne obejmują tekst, pełny URL, tekst z URL, dwa szybkie kliknięcia, timeout po zapisie na serwerze, ponowienie po odświeżeniu, konflikt ze starym szkicem, wygaśnięcie sesji oraz zmianę konta. Dla Skrzynki użyć zbioru przekraczającego jedną stronę i sprawdzić wynik znajdujący się dopiero na kolejnej. Dla dat i filtrów sprawdzić zapisany widok, Wstecz oraz wejście z Projektu.

Odbiór iPhone obejmuje Safari i instalację PWA, aktualną wersję iOS użytkownika, klawiaturę, dyktowanie systemowe jako zwykłe wejście tekstu, VoiceOver, większy tekst, przełączanie aplikacji oraz zimny start. Symulacja desktopowej szerokości nie zamyka tego odbioru. Service worker i powiadomienia wymagają produkcyjnego builda w środowisku z HTTPS.

Przed zmianą wykonać kilka prób obecnej ścieżki; po etapach 1–3 powtórzyć te same scenariusze. Cele do sprawdzenia, nie aktualne wyniki:

- Jedno pole wymagane i brak obowiązkowych wyborów organizacyjnych w Capture.
- Od dotknięcia skrótu do gotowego pola: docelowo do 3 sekund przy aktywnej sesji i typowej sieci; zimny start mierzyć osobno.
- Krótka, wcześniej ustalona myśl: zapis w około 10 sekund od wejścia; oddzielnie notować czas pisania i czas obsługi aplikacji.
- Brak utraty treści i duplikatów w scenariuszach błędu.
- Możliwość znalezienia surowego wpisu bez wcześniejszej klasyfikacji.

Następnie przeprowadzić dwutygodniową próbę codziennego użycia. Ocenić, czy mniej myśli zostaje niezapisanych, czy łatwiej wrócić po przerwie i czy przypomnienie pomaga, czy przeszkadza. Nie wymagać codziennej aktywności ani większej liczby wpisów jako celu samego w sobie. Ewentualne pomiary techniczne zbierają czas, miejsce wejścia i wynik operacji, bez treści, tytułów, URL i stałego śledzenia zachowania.

## Decyzje przed kolejnymi etapami

Przyjęte: iPhone jako główne urządzenie, neutralny globalny Capture, osobne kontekstowe tworzenie Działań i Notatek, brak obowiązkowego porządkowania oraz przypomnienia wyłączone domyślnie.

Przed etapem 2 ustalić docelowy adres wdrożenia i sprawdzić skrót na używanym iPhonie. Przed etapem 4 wybrać z użytkownikiem dni, godzinę i cel przypomnienia; nie zakładać ich na podstawie tej rozmowy. Przed etapem 6 zdecydować na podstawie pilotażu, czy ważniejszy jest zapis przy braku sieci, czy udostępnianie z Safari. Te decyzje nie blokują etapu 1.

Powiązane dokumenty: [wcześniejszy audyt UX](../audits/2026-10-04-ui-ux/AUDYT-UI-UX.md), [plan Startu i Wiedzy](./2026-10-04-product-improvements-plan.md), [plan przechwytywania offline](./plan-04-offline-capture.md). W przypadku konfliktu propozycji UX w tych dokumentach, niniejszy plan określa nowszy kierunek dla szybkiego zapisu, powrotu i przypominania.


## Stan implementacji — 25 października 2026

Wdrożono w kodzie stały Szybki zapis i `/capture`, trwałe szkice z identyfikatorem ponowienia, kontrolowane Cofnij, uproszczony Start, lokalny powrót do pracy, podgląd surowych wpisów, filtrowanie Skrzynki na serwerze, sesję trzech wpisów, niezależne filtry statusu i daty, jawne przypięcie oraz pauzowanie komunikatów podczas interakcji. Daty w formularzu Działania są dostępne od razu. Dawne szkice i ich formularze pozostają dostępne do odzyskania, zamiast być usuwane podczas aktualizacji.

Przygotowano ustawienia przypomnienia, migrację RLS, service worker, funkcję Edge i skrypt Cron. [Instrukcja konfiguracji i odbioru push](../deployment/return-reminders.md) opisuje pozostałe kroki. Nie ustawiono użytkownikowi pory powiadomień ani nie włączono wysyłki na serwerze. Instrukcja skrótu iPhone jest dostępna w Ustawieniach i z `/capture`.

Warunkowe udostępnianie z Safari i automatyczna kolejka offline pozostają poza tym wydaniem, zgodnie z etapem 6. Szkic przetrwa zamknięcie i błąd połączenia, ale oczekuje świadomego ponowienia zapisu. Dalsze scalanie starszych formularzy wymaga osobnej migracji ich szkiców; obecne wejścia kontekstowe korzystają ze wspólnego QuickAdd, zachowując dostęp do dawnych szkiców.

Weryfikacja lokalna: 531 testów Vitest w 77 plikach, dwa testy Deno, kontrola TypeScript, lint oraz produkcyjny build PWA. W przeglądarce przy szerokości 390 px sprawdzono zapis, otwarcie oryginału bez porządkowania, odzyskanie szkicu, odwracalne Cofnij i skrót do ostatnio otwartej pracy. [Podgląd Startu](evidence/2026-10-25/start-mobile.jpg) i [Szybkiego zapisu](evidence/2026-10-25/capture-mobile.jpg). Build zgłasza ostrzeżenie o części pakietów JavaScript większych niż 500 kB; nie blokuje to kompilacji. Rzeczywisty odbiór push i klawiatura Safari pozostają do sprawdzenia na iPhonie po konfiguracji wdrożenia.
