# Backlog techniczny poprawek po audycie UI/UX

Data: 5 sierpnia 2026
Źródło: [Audyt UI/UX](../audits/2026-08-04-ui/AUDYT-UI-UX.md)
Status: historyczny — zastąpiony wdrożonym kierunkiem Projekt–Cel

## Cel i zasady realizacji

Backlog domyka wszystkie 15 sprawdzonych kroków oraz rekomendacje P0–P3. Każdy
ticket jest pionowym wycinkiem: ma dostarczyć działającą ścieżkę w trybie demo i
Supabase, UI desktop/mobile, obsługę błędu i testy. Nie należy realizować osobno
„samej bazy”, „samego store” albo „samego CSS”, ponieważ takie poziome zadania
nie dają użytkownikowi gotowej funkcji.

Stałe wymagania dla każdego ticketu:

- mutacje przechodzą przez typowaną komendę domenową i zachowują rollback po
  błędzie zdalnym;
- tryb demo i Supabase mają ten sam kontrakt i wynik;
- nowe mutacje Supabase są idempotentne, respektują RLS i izolację Workspace'u;
- UI ma jawne stany `loading`, `success`, `error`, `empty` i możliwość retry;
- operacje odwracalne używają toastu Undo, a nieodwracalne potwierdzenia;
- podstawowa ścieżka działa na desktopie, mobile i klawiaturze;
- ticket dodaje test domenowy, komponentowy/regresyjny i — gdy dotyka SQL —
  test migracji/RLS;
- przed scaleniem przechodzą `pnpm lint`, `pnpm typecheck`, `pnpm test` i
  `pnpm build`.

## Decyzje techniczne rekomendowane przed startem

1. Szczegóły Wiedzy mają kanoniczny adres `/knowledge/:knowledgeId`.
   Dotychczasowe `/knowledge?item=:id` zostaje obsłużone jako kompatybilny
   redirect, aby stare linki nie przestały działać.
2. Do czasu powstania prawdziwego uploadu i nagrywania w produkcyjnym UI
   zostają tylko `Tekst` oraz `Link`. `Głos` i `Plik` nie mogą zapisywać
   tekstowego rekordu pod fałszywym typem.
3. „Odłóż do jutra” oznacza następny dzień o 09:00 w strefie aktywnego
   Workspace'u, a nie 24 godziny od kliknięcia.
4. Na mobile akcje Działania używają wzorca: `Ukończ`, `Następne`, `Więcej`.
   `Więcej` otwiera dostępny bottom sheet oparty na wspólnym `Modal`.
5. Zmiana Celu na `abandoned` wymaga powodu. Zmiana na `achieved` pokazuje
   kryteria i otwarte Działania oraz wymaga świadomego potwierdzenia.

Decyzje 2 i 5 są checkpointami HITL. Pozostałe można wdrażać AFK.

## Mapa 15 kroków audytu do ticketów

| Krok | Widok | Tickety |
|---:|---|---|
| 01 | Dzisiaj — desktop | UIX-04, UIX-19 |
| 02 | Cele — desktop | UIX-08, UIX-09, UIX-18 |
| 03 | Nowy Cel | UIX-08 |
| 04 | Szczegóły Celu — desktop | UIX-05, UIX-06, UIX-07, UIX-16, UIX-18 |
| 05 | Inbox — desktop | UIX-01, UIX-03, UIX-10, UIX-11 |
| 06 | Wiedza — desktop | UIX-02, UIX-12, UIX-18 |
| 07 | Nowy element Wiedzy | UIX-12 |
| 08 | Dzisiaj — mobile | UIX-04, UIX-15, UIX-17 |
| 09 | Cele — mobile | UIX-09, UIX-15, UIX-17 |
| 10 | Szczegóły Celu — mobile | UIX-05, UIX-06, UIX-16, UIX-17 |
| 11 | Inbox — mobile | UIX-01, UIX-03, UIX-10, UIX-11, UIX-15 |
| 12 | Wiedza — mobile | UIX-02, UIX-12, UIX-15, UIX-17 |
| 13 | Seria cykliczna — mobile | UIX-13, UIX-17 |
| 14 | Globalne przechwycenie — mobile | UIX-10, UIX-18 |
| 15 | Wyszukiwanie globalne | UIX-02, UIX-14, UIX-15 |

## Proponowane tickety

### UIX-01 — Przywracanie odłożonych elementów i historia Inboxu

**Typ:** AFK
**Priorytet:** P0
**Zablokowane przez:** brak

#### Co zbudować

Odłożony element ma być widoczny w zakładce „Odłożone”, pokazywać termin
powrotu i po jego upływie automatycznie wracać do „Do przetworzenia”. Historia
ma również obejmować elementy zakończone i odrzucone oraz pozwalać na ręczne
przywrócenie.

#### Zakres techniczny

- Dodać domenowy selektor materializujący `snoozed` z terminem `<= now` jako
  `unprocessed`, bez tworzenia nowego rekordu.
- Dodać idempotentną komendę/RPC `release_due_inbox_items` dla Workspace'u;
  wywoływać ją przy wejściu do Inboxu, po odzyskaniu fokusu karty i podczas
  `reload`.
- Wyliczać „jutro 09:00” w `workspace.timezone`; przekazywać do domeny zegar i
  strefę zamiast korzystać bezpośrednio z `Date.now()`.
- Rozszerzyć UI o zakładki wynikające ze statusu i stabilny parametr
  `?view=unprocessed|snoozed|resolved|discarded`.
- Dodać akcję „Przywróć teraz”, termin w formacie lokalnym i Undo dla
  odrzucenia/przywrócenia.

#### Kryteria akceptacji

- [ ] Element odłożony znika z bieżącej listy i pojawia się w „Odłożone”.
- [ ] Po terminie wraca dokładnie raz do „Do przetworzenia” w demo i Supabase.
- [ ] Równoległe wywołania materializacji nie duplikują zdarzeń ani zmian.
- [ ] Historia `resolved` i `discarded` jest dostępna i umożliwia przywrócenie.
- [ ] Testy obejmują zmianę czasu, granicę dnia, strefę Workspace'u i RLS.

### UIX-02 — Szczegóły, edycja i kanoniczny deep link Wiedzy

**Typ:** AFK
**Priorytet:** P0
**Zablokowane przez:** brak

#### Co zbudować

Kliknięcie karty lub wyniku wyszukiwania otwiera pełny element Wiedzy. Widok
umożliwia zmianę tytułu, treści, rodzaju, URL źródła i relacji oraz pokazuje
backlinki do Celów, Działań i serii.

#### Zakres techniczny

- Dodać route `/knowledge/:knowledgeId` i kompatybilny redirect z `?item=`.
- Dodać komendę `update_knowledge` aktualizującą atomowo encję, zawartość
  Wiedzy i znacznik `updated_at`; odpowiednik zdalny powinien być idempotentnym
  RPC.
- Zwracać czytelny stan `not found`, także dla obiektu z innego Workspace'u.
- Uczynić kartę/wiersz jednym linkiem podstawowym; Archive/Kosz przenieść do
  menu kontekstowego bez zagnieżdżania przycisków w linku.
- Pokazać osobno treść, źródło, typ, relacje, datę aktualizacji i historię
  pochodzenia z Inboxu.

#### Kryteria akceptacji

- [ ] `/knowledge/:id` odtwarza ten sam element po odświeżeniu.
- [ ] Stary link `/knowledge?item=:id` nie kończy na ogólnej liście.
- [ ] Edycja działa i rollbackuje się po błędzie Supabase.
- [ ] Linki do powiązanych obiektów prowadzą do dokładnych obiektów.
- [ ] Karta Wiedzy jest dostępna klawiaturą i ma jednoznaczną nazwę.

### UIX-03 — Prawdziwe typy przechwycenia i walidacja linku

**Typ:** HITL
**Priorytet:** P0
**Zablokowane przez:** brak

#### Co zbudować

Każdy widoczny typ przechwycenia musi wykonywać operację zgodną z nazwą. W
rekomendowanym wariancie pierwszego wydania UI oferuje Tekst i Link, rozpoznaje
URL automatycznie i nie pokazuje niedziałających opcji Głos/Plik.

#### Zakres techniczny

- Wyodrębnić wspólną funkcję normalizacji capture: trim, rozpoznanie URL,
  walidacja protokołu `http/https` i bezpieczny podgląd domeny.
- Uniemożliwić utworzenie `voice` bez identyfikatora nagrania oraz `file` bez
  identyfikatora załącznika. Jeżeli typy mają zostać wdrożone teraz, wymagają
  osobnego modelu załączników, Storage, limitów, postępu uploadu i polityk RLS.
- Dodać jawny komunikat walidacyjny dla niepoprawnego linku oraz retry.
- Zachować kompatybilność odczytu ze starymi rekordami `voice/file`, ale nie
  tworzyć nowych nieprawidłowych rekordów.

#### Kryteria akceptacji

- [ ] UI nie obiecuje funkcji, której nie wykonuje.
- [ ] Poprawny URL zapisuje się jako Link i pokazuje bezpieczny podgląd.
- [ ] Niepoprawny URL nie jest wysyłany i ma błąd powiązany z polem.
- [ ] API odrzuca `voice/file` bez trwałego zasobu, niezależnie od klienta.
- [ ] Odczyt istniejących rekordów wszystkich czterech typów nadal działa.

### UIX-04 — Zwykłe Działanie i Przypnij/Odepnij w widoku Dzisiaj

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** brak

#### Co zbudować

Użytkownik może dodać zwykłe Działanie bezpośrednio z Dzisiaj oraz jawnie
przypiąć i odpiąć dowolne otwarte Działanie. Seria cykliczna pozostaje akcją
drugorzędną.

#### Zakres techniczny

- Dodać formularz/modal tworzący `create_action` z opcjonalnym Celem/Obszarem
  i domyślnym `pinnedToToday=true`.
- Dodać akcję `Przypnij/Odepnij` do wiersza Działania i szczegółów Celu,
  wykorzystując istniejące `update_action.pinnedToToday`.
- Po zmianie natychmiast aktualizować projekcję Dzisiaj i oferować Undo.
- Pusty stan ma dwa CTA: główne „Dodaj Działanie” i drugorzędne „Nowe
  cykliczne”; przy niepustej liście zachować szybkie dodawanie.
- Dodać mały panel sugestii tylko z realnych danych: zaległe, brak następnego
  Działania, pilny Inbox.

#### Kryteria akceptacji

- [ ] Nowe zwykłe Działanie pojawia się w Dzisiaj bez przejścia przez Inbox.
- [ ] Przypięcie i odpięcie działa w demo i Supabase oraz ma Undo.
- [ ] Działania zakończone/anulowane nie pojawiają się jako sugestie.
- [ ] Pusty stan nie kieruje wyłącznie do serii cyklicznej.

### UIX-05 — Responsywne menu Działania i bezpieczne zmiany statusu

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** UIX-16

#### Co zbudować

Na mobile Działanie pokazuje tylko `Ukończ`, `Następne` i `Więcej`. Pozostałe
operacje są dostępne w bottom sheecie. „Anuluj” zmienia nazwę na „Anuluj
Działanie” i korzysta z Undo.

#### Zakres techniczny

- Wydzielić komponent akcji współdzielony przez Dzisiaj i szczegóły Celu.
- W komponencie użyć lokalnego stanu mutacji per `actionId`, aby blokować
  wieloklik bez zamrażania całej listy.
- Na desktopie akcje drugorzędne pokazywać przy hover/focus; na mobile w
  menu `Więcej` opartym na wspólnym `Modal`.
- Dodać deep-link/fokus `?action=:id`, potrzebny później wyszukiwarce.
- Wszystkie zmiany statusu odwracalne mają przywracać dokładny wcześniejszy
  status i blocker, nie zawsze sztywne `ready`.

#### Kryteria akceptacji

- [ ] Pasek akcji nie zawija się na szerokości 390 px.
- [ ] Główne cele dotykowe mają minimum 44×44 px.
- [ ] Anulowanie, pominięcie i ukończenie mają loading, błąd oraz Undo.
- [ ] `?action=:id` przewija do elementu i przenosi na niego fokus.
- [ ] Menu jest obsługiwane klawiaturą i czytnikiem ekranu.

### UIX-06 — Checklista Działania bez utraty postępu

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** brak

#### Co zbudować

Checklista jest widoczna pod Działaniem, każdy punkt można zaznaczyć, a edycja
tytułów nie resetuje istniejącego postępu.

#### Zakres techniczny

- Dodać komendę `set_action_checklist_item` albo bezpieczny patch
  `update_action`, który zachowuje stabilne identyfikatory punktów.
- Przy edycji dopasowywać istniejące elementy po ID, dodawać nowe ID i usuwać
  tylko jawnie skasowane elementy; nie generować ID z indeksu i nie ustawiać
  wszystkich `completed=false`.
- Zdalny zapis JSONB musi chronić przed utratą równoległej zmiany przez wersję
  rekordu lub atomowy RPC.
- Pokazać postęp `ukończone/wszystkie` oraz disabled dla zakończonych działań.

#### Kryteria akceptacji

- [ ] Zaznaczenie punktu przeżywa odświeżenie w demo i Supabase.
- [ ] Zmiana nazwy Działania lub punktu nie resetuje innych punktów.
- [ ] Dodanie/usunięcie punktu nie zmienia ID pozostałych.
- [ ] Test obejmuje konflikt wersji i rollback po błędzie.

### UIX-07 — Edycja Celu, kryteria i kontrolowane zakończenie

**Typ:** HITL
**Priorytet:** P1
**Zablokowane przez:** brak

#### Co zbudować

Użytkownik edytuje tytuł, rezultat, Obszar, priorytet, termin i kryteria Celu.
Kryteria można oznaczać jako spełnione. Osiągnięcie lub porzucenie Celu jest
świadomą decyzją z zapisem w historii postępu.

#### Zakres techniczny

- Dodać komendy `update_goal`, `upsert_goal_criterion`,
  `set_goal_criterion_completed` i `delete_goal_criterion`.
- Dodać idempotentne RPC obejmujące aktualizację Celu/kryteriów oraz polityki
  RLS; dla przejścia statusu użyć transakcji zapisującej również
  `progress_entry`.
- Przed `achieved` wyświetlić niespełnione kryteria i otwarte Działania. Przed
  `abandoned` wymagać krótkiego powodu.
- Rozdzielić status domenowy od widoczności Archive/Kosz w interfejsie.

#### Kryteria akceptacji

- [ ] Wszystkie edytowalne pola i kryteria przeżywają odświeżenie.
- [ ] Kryteria są interaktywne i dostępne klawiaturą.
- [ ] Porzucenie bez powodu jest odrzucone także przez backend.
- [ ] Zmiana statusu tworzy czytelny wpis historii postępu.
- [ ] Archive/Kosz nie wyglądają jak status realizacji Celu.

### UIX-08 — Poprawiony formularz tworzenia Celu

**Typ:** AFK
**Priorytet:** P2
**Zablokowane przez:** UIX-07 dla tworzenia kryteriów w tym samym formularzu

#### Co zbudować

Formularz ma jednoznaczne etykiety, walidację przy polach i opcjonalne kryteria
ukończenia. Szablon „Pusty cel” nie powtarza tej samej etykiety dla nazwy i
rezultatu.

#### Zakres techniczny

- Oddzielić etykietę nazwy od `outcomePrompt`; rekomendowane: „Nazwa Celu” i
  „Po czym poznasz, że Cel jest osiągnięty?”.
- Rozszerzyć `create_goal_with_action` o opcjonalne kryteria albo wykonać ich
  zapis w tej samej transakcji.
- Dodać walidację długości/trim, komunikaty per pole i stan błędu bez utraty
  danych formularza.
- Zachować prawidłowy autofocus, trap fokusu i powrót fokusu po zamknięciu.

#### Kryteria akceptacji

- [ ] Każde pole ma unikalną, zrozumiałą etykietę.
- [ ] Kryteria zapisują się atomowo z Celem.
- [ ] Błąd zdalny nie czyści formularza.
- [ ] Testy pokrywają każdy szablon i pusty/niepoprawny input.

### UIX-09 — Cele: filtry mobilne, semantyka i sygnały na kartach

**Typ:** AFK
**Priorytet:** P2
**Zablokowane przez:** UIX-07

#### Co zbudować

Lista Celów pokazuje liczbę wyników i aktywne filtry. Na mobile filtry są w
arkuszu „Filtry (n)”. Cała karta jest klikalna i komunikuje ważne sygnały:
brak następnego Działania, zaległość lub blokadę.

#### Zakres techniczny

- Utrzymać stan filtrów w URL, dodać normalizację niepoprawnych parametrów i
  przycisk „Wyczyść filtry”.
- Zastąpić grupę przycisków semantyką tablisty albo `aria-pressed`.
- Rozdzielić filtry statusu domenowego od Archive/Kosz.
- Dodać selektor sygnałów oparty na Działaniach, bez dodatkowych zapytań per
  karta.
- Ujednolicić wysokość kart, kontrolowane zawijanie tytułu i pozycję CTA.

#### Kryteria akceptacji

- [ ] Filtry można obsłużyć klawiaturą i ich stan jest programowo dostępny.
- [ ] Na 390 px lista zaczyna się bez siedmiu rzędów filtrów nad treścią.
- [ ] Karta otwiera Cel z dowolnego bezpiecznego miejsca.
- [ ] Liczba wyników i aktywne filtry zgadzają się z URL.

### UIX-10 — Jeden komponent przechwycenia z trwałym draftem

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** UIX-03

#### Co zbudować

Capture w Inboxie, globalnym modalu i istniejącym komponencie Quick Capture ma
ten sam kontrakt, walidację, draft, skrót klawiaturowy i komunikaty.

#### Zakres techniczny

- Wydzielić współdzielony `CaptureComposer` z kontrolowanym stanem, obsługą
  draftu i callbackiem zapisu.
- Klucz draftu musi rozróżniać kontekst, ale zachowanie zamknięcia i retry ma
  być wspólne.
- Zmienić copy na `Zamknij`, `Zapisz do Inboxu` i status „Draft zapisany na tym
  urządzeniu”; „Odrzuć draft” pozostawić jako akcję drugorzędną.
- Po sukcesie ogłosić rezultat przez region live i przywrócić fokus.

#### Kryteria akceptacji

- [ ] Każde wejście capture zachowuje tekst po zamknięciu i błędzie.
- [ ] Skrót Ctrl/Cmd+Enter działa identycznie.
- [ ] Wieloklik tworzy najwyżej jeden rekord.
- [ ] Użytkownik rozróżnia zapis draftu od zapisu do Inboxu.

### UIX-11 — Lokalne loading/error/retry dla mutacji list

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** brak

#### Co zbudować

Triage, snooze, odrzucenie, archiwizacja i zmiany statusu pokazują stan przy
konkretnym elemencie. Błąd jest widoczny także na mobile, gdzie topbar znika.

#### Zakres techniczny

- Wprowadzić współdzielony hook stanu mutacji indeksowany kluczem
  `operation:entityId`.
- Przycisk ma `aria-busy`, jest blokowany w trakcie i zachowuje etykietę
  wystarczającą dla czytnika.
- Błąd lokalny pokazuje retry obok elementu oraz trafia do globalnego regionu
  live; globalny wskaźnik synchronizacji pozostaje informacją dodatkową.
- Przy przeładowaniu list stosować skeleton zachowujący jej geometrię.

#### Kryteria akceptacji

- [ ] Jedna mutacja nie blokuje niezależnych elementów listy.
- [ ] Nie da się wysłać tej samej operacji wielokrotnie przez szybki klik.
- [ ] Błąd i retry są widoczne na mobile bez topbara.
- [ ] Skeleton nie powoduje dużego skoku layoutu.

### UIX-12 — Relacje i metadane Wiedzy oraz dostępny multi-select

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** UIX-02

#### Co zbudować

Tworzenie i edycja Wiedzy używa comboboxu z wyszukiwaniem i chipami dla wielu
Celów. Lista pokazuje osobno źródło, opis, typ i faktyczne relacje, również na
mobile.

#### Zakres techniczny

- Zbudować dostępny komponent wielokrotnego wyboru oparty na
  combobox/listbox; obsłużyć strzałki, Enter, Escape, Backspace i usuwanie
  chipa.
- Zapisywać różnicę relacji: nowe linki dodać, usunięte odpiąć, nie usuwać i
  tworzyć wszystkich od nowa.
- Zapewnić atomowy zapis Wiedzy i relacji lub kontrolowany rollback całej
  operacji.
- Zachować widoczny badge typu na mobile i dodać liczbę wyników/filtrów oraz
  „Wyczyść filtry”.

#### Kryteria akceptacji

- [ ] Wiele Celów można wybrać klawiaturą i dotykiem.
- [ ] Edycja relacji nie tworzy duplikatów.
- [ ] Metadane nie pokazują jednocześnie relacji i „Bez powiązań”.
- [ ] Typ Wiedzy jest widoczny na mobile bez polegania wyłącznie na ikonie.

### UIX-13 — Mobilny formularz serii cyklicznej

**Typ:** AFK
**Priorytet:** P2
**Zablokowane przez:** brak

#### Co zbudować

Formularz dzieli się na „Podstawy” i rozwijane „Więcej opcji”. Pasek
Anuluj/Zapisz jest przyklejony na dole arkusza, a podgląd terminów używa
polskiego formatu.

#### Zakres techniczny

- Dodać wariant `Modal`/bottom sheet z przewijaną treścią i sticky footerem,
  respektujący safe-area oraz klawiaturę ekranową.
- W podstawach zostawić nazwę, częstotliwość i początek; resztę ujawniać
  progresywnie bez utraty wartości.
- Sformatować preview przez `Intl.DateTimeFormat("pl-PL")`; pełne ISO
  pozostawić w `dateTime` lub tooltipie.
- Dodać lokalny loading, błąd i blokadę duplikatu podczas zapisu.

#### Kryteria akceptacji

- [ ] Główne CTA jest dostępne bez przewinięcia do końca formularza.
- [ ] Aktywne pole nie jest zasłonięte przez klawiaturę ekranową.
- [ ] Złożenie/rozwinięcie opcji nie kasuje danych.
- [ ] Daty są czytelne po polsku i mają maszynową wartość ISO.

### UIX-14 — Stabilne wyniki wyszukiwania dla każdego typu obiektu

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** UIX-01, UIX-02, UIX-05

#### Co zbudować

Każdy wynik prowadzi do dokładnego obiektu: Celu, Działania, Wiedzy lub Inboxu.
Po nawigacji obiekt jest widoczny, podświetlony i ma fokus.

#### Zakres techniczny

- Wprowadzić centralny builder adresów obiektów zamiast składania URL-i w
  komponencie wyszukiwarki.
- Mapowanie: Cel `/goals/:id`, Działanie `/goals/:goalId?action=:id` lub
  `/actions/:id` dla samodzielnego, Wiedza `/knowledge/:id`, Inbox
  `/inbox?item=:id&view=:status`.
- Obsłużyć obiekty niedostępne, zarchiwizowane i samodzielne bez cichego
  przenoszenia na stronę ogólną.
- Zachować zapytanie przy powrocie oraz poprawną semantykę combobox/listbox.

#### Kryteria akceptacji

- [ ] Każdy typ wyniku otwiera dokładny rekord.
- [ ] Enter i klik prowadzą do identycznego adresu i stanu.
- [ ] Niedostępny wynik pokazuje wyjaśnienie zamiast pustej strony.
- [ ] Testy obejmują samodzielne Działanie i każdy status Inboxu.

### UIX-15 — Mobilne menu Workspace, wyszukiwanie i badge Inboxu

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** UIX-14

#### Co zbudować

Mobile odzyskuje dostęp do wyszukiwania, stanu synchronizacji, konta, eksportu,
resetu demo/wylogowania oraz licznika Inboxu.

#### Zakres techniczny

- Dodać mobilny nagłówek z akcją wyszukiwania i menu Workspace; wykorzystać
  istniejące operacje AppShell, nie duplikować ich implementacji.
- Otwierać GlobalSearch w mobilnym dialogu/sheet z tym samym modelem wyników.
- Dodać badge do pozycji Inbox w dolnej nawigacji i dostępny opis liczby.
- Pokazać `syncing/error/offline` w menu i w live regionie; retry uruchamia
  `reload`.

#### Kryteria akceptacji

- [ ] Wszystkie funkcje ukrytego sidebara/topbara są osiągalne na 390 px.
- [ ] Badge aktualizuje się po capture, triage, snooze i przywróceniu.
- [ ] Błąd synchronizacji można odczytać i ponowić na mobile.
- [ ] Menu zarządza fokusem i zamyka się przez Escape/backdrop.

### UIX-16 — Migracja dialogów Działania na wspólny Modal

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** brak

#### Co zbudować

Dialog blokady, edycji Działania i wiązania Wiedzy korzysta ze wspólnego
komponentu Modal zamiast własnego markupu.

#### Zakres techniczny

- Zachować osobne kontrolowane formularze, ale delegować backdrop, Escape,
  focus trap, autofocus, `aria-labelledby` i przywrócenie fokusu do Modal.
- Podczas zapisu ustawić `closeDisabled`, loading oraz błąd w dialogu.
- Upewnić się, że otwarcie dialogu z menu mobilnego zamyka poprzedni sheet i
  nie tworzy dwóch nakładających się pułapek fokusu.

#### Kryteria akceptacji

- [ ] Każdy z trzech dialogów zamyka się przez Escape i bezpieczny backdrop.
- [ ] Tab/Shift+Tab nie opuszcza dialogu.
- [ ] Po zamknięciu fokus wraca do przycisku wywołującego.
- [ ] Dialog nie zamyka się w trakcie zapisu.

### UIX-17 — Semantyka wyboru, etykiety i cele dotykowe

**Typ:** AFK
**Priorytet:** P1
**Zablokowane przez:** UIX-05, UIX-09, UIX-12, UIX-13, UIX-15

#### Co zbudować

Końcowy hardening interakcji: wszystkie filtry, typy, ikony i kontrolki daty
mają programowy stan, jednoznaczną nazwę i odpowiedni rozmiar dotykowy.

#### Zakres techniczny

- Użyć `aria-pressed`, radio group albo tablisty zgodnie z zachowaniem
  kontrolki; nie opierać zaznaczenia wyłącznie na kolorze.
- Dodać etykiety i tooltipy do ikon, w szczególności ukrytego inputu daty.
- Wymusić minimum 44×44 px dla kluczowych kontrolek na mobile, z odstępem
  zapobiegającym przypadkowym kliknięciom.
- Przeprowadzić test klawiaturą, zoom 200% i automatyczny smoke test semantyki.

#### Kryteria akceptacji

- [ ] Stan każdej kontrolki wyboru jest dostępny programowo.
- [ ] Każdy icon-only button ma nazwę i widoczny focus ring.
- [ ] Kluczowe mobile touch targets mają minimum 44×44 px.
- [ ] Przy zoomie 200% nie znika podstawowa akcja ani treść.

### UIX-18 — Spójny język i wzorzec akcji destrukcyjnych

**Typ:** HITL
**Priorytet:** P2
**Zablokowane przez:** UIX-01, UIX-02, UIX-05, UIX-07, UIX-10, UIX-12

#### Co zbudować

Interfejs używa jednego słownika: `Archiwum`, `Kosz`, `Cel`, `Działanie`,
`Wiedza`. Akcje destrukcyjne mają inną wagę wizualną niż bezpieczne i jeden
model Undo/potwierdzenia.

#### Zakres techniczny

- Utworzyć mały moduł etykiet domenowych/statusów, aby ograniczyć rozjazdy
  między stronami.
- Zamienić mieszane `Archive/Trash` oraz niejednoznaczne `Anuluj`.
- Archive i odwracalne statusy: optimistic update + Undo. Kosz i operacje
  ryzykowne: wspólny AlertDialog albo jasno opisane Undo zgodnie z decyzją.
- Ujednolicić kolory i warianty przycisków destrukcyjnych.

#### Kryteria akceptacji

- [ ] W aktywnym UI nie występują mieszane polsko-angielskie statusy.
- [ ] `Anuluj` oznacza zamknięcie formularza, a `Anuluj Działanie` zmianę stanu.
- [ ] Akcje destrukcyjne nie wyglądają jak neutralne linki.
- [ ] Test regresyjny chroni kluczowe etykiety i wzorzec Undo.

### UIX-19 — Finalny pass stanów pustych, rytmu i wizualnego QA

**Typ:** HITL
**Priorytet:** P3
**Zablokowane przez:** UIX-01–UIX-18

#### Co zbudować

Po domknięciu funkcji wykonać finalny pass pustych stanów, filtrów, kart,
overlayu wyszukiwania i widoczności akcji drugorzędnych. Ticket nie może
maskować braków funkcjonalnych samym CSS.

#### Zakres techniczny

- Dostosować pusty stan do kontekstu i zapewnić realne CTA oraz czyszczenie
  filtrów.
- Wyrównać rytm kart Celów, nagłówków i gęstych grup filtrów.
- Poprawić kontrast aktywnego wyniku wyszukiwania bez zlewania nieaktywnych
  wierszy w jednolity blok.
- Na desktopie pokazywać akcje drugorzędne po hover i focus-within, a na mobile
  pod `Więcej`, bez ukrywania ich przed klawiaturą.
- Powtórzyć zestaw 15 screenshotów w tych samych viewportach i porównać z
  audytem bazowym.

#### Kryteria akceptacji

- [ ] Każdy pusty i filtrowany stan wskazuje sensowną następną akcję.
- [ ] Układ nie ma przepełnień przy 390×844, 1440×1000 i zoomie 200%.
- [ ] Hover i focus odsłaniają te same akcje na desktopie.
- [ ] Review HITL akceptuje 15 nowych screenshotów porównawczych.

## Kolejność wdrożenia

### Faza A — naprawa złamanych obietnic

1. UIX-16 — wspólny Modal dla Działań.
2. UIX-01 — snooze i historia Inboxu.
3. UIX-02 — szczegóły i edycja Wiedzy.
4. UIX-03 — prawdziwe typy capture.
5. UIX-11 — lokalne loading/error/retry.

### Faza B — główny loop Celu i Działania

1. UIX-04 — zwykłe Działanie i przypinanie w Dzisiaj.
2. UIX-05 — responsywne akcje Działania.
3. UIX-06 — checklista bez utraty postępu.
4. UIX-07 — edycja Celu, kryteria i statusy.
5. UIX-08 — tworzenie Celu.

### Faza C — listy, mobile i nawigacja

1. UIX-09 — lista i filtry Celów.
2. UIX-10 — wspólny CaptureComposer.
3. UIX-12 — relacje i metadane Wiedzy.
4. UIX-13 — formularz serii cyklicznej.
5. UIX-14 — dokładne wyniki wyszukiwania.
6. UIX-15 — mobilny shell.

### Faza D — dostępność i polerowanie

1. UIX-17 — semantyka i cele dotykowe.
2. UIX-18 — język i akcje destrukcyjne.
3. UIX-19 — finalne QA i screenshoty.

## Proponowany podział AFK/HITL

- **AFK:** UIX-01, 02, 04, 05, 06, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17.
- **HITL:** UIX-03 (zakres Voice/File), UIX-07 (reguła osiągania i porzucania),
  UIX-18 (słownik i poziom potwierdzeń), UIX-19 (review wizualny).

## Punkty kontrolne

1. Po Fazie A ponownie przejść Inbox → Wiedza → wyszukiwanie i potwierdzić, że
   każda widoczna opcja działa zgodnie z nazwą.
2. Po Fazie B przejść Dzisiaj → Cel → Działanie → checklista → zakończenie Celu
   na desktopie i mobile.
3. Po Fazie C sprawdzić pełną aplikację na 390 px bez używania ukrytego
   desktopowego sidebara/topbara.
4. Po Fazie D powtórzyć audyt 15 kroków, test klawiaturą i test Supabase na
   lokalnym stosie. Zdalnej migracji nie wdrażać bez osobnego polecenia.
