# Plan rozwoju aplikacji opartej na Projektach i Celach

## Szybki zapis i regularny powrót z 24 października 2026

[Plan szybkiego zapisu i powrotu do Command](./2026-10-24-easy-capture-and-return-plan.md)
odpowiada na dwa wskazane problemy: zapominanie o aplikacji i zbyt duży wysiłek
przy zapisie. Obejmuje jeden prosty Capture, skrót na iPhonie, spokojniejszy Start,
odnajdywanie wpisów bez obowiązkowego porządkowania oraz opcjonalne przypomnienie.
Wskazuje elementy do usunięcia lub ukrycia, kolejność sześciu etapów, reguły danych,
ochronę szkiców, odbiór na telefonie i mierniki pilotażu.
Status: plan do wdrożenia; bez zmian kodu i bez włączania przypomnień.

## Poprawki Startu i rozwój Wiedzy z 4 października 2026

[Szczegółowy plan poprawek i rozwoju](./2026-10-04-product-improvements-plan.md)
rozpisuje pięć poprawek pierwszego wydania: zgodne metryki tygodnia, rekomendacje
respektujące termin powrotu do blokady, kompaktowy stan starej analizy AI,
czytelne etykiety planu oraz dostępny wybór Czytelni. Kolejne wydania obejmują
podpowiedzi Wiedzy, eksport kontekstu do AI i opcjonalne funkcje. Dokument
zawiera mapę kodu, reguły danych, zależności, testy, kryteria odbioru i sposób
wycofania. Status: pierwsze wydanie, podpowiedzi Wiedzy, eksport AI, ulubione widoki i postęp czytania zaimplementowane lokalnie; 522 testy przeszły. Migracje i pełny odbiór pozostają do wykonania. [Raport realizacji i weryfikacji](./2026-10-04-product-improvements-implementation.md).

Plan uwzględnia kod sprawdzony 4 października: plan tygodnia, data powrotu do
blokady, krótkie notatki i Czytelnia mają już implementację. Historyczne statusy
poniżej nie są kompletną ewidencją bieżącego wdrożenia ani jego odbioru.

## Poprawki po review mobilnego UI i UX z 30 września 2026

[Plan poprawek po review zmian Luny](./2026-09-30-mobile-ui-ux-review-fixes-plan.md)
obejmuje cofanie ukończenia i przywracanie następnego kroku, bezpieczny ekran
ładowania, stabilną edycję opisu w Quick Add oraz kompletne oznaczenie filtrów.
Zawiera kolejność prac, mapę kodu, testy regresji i kryteria odbioru.
Status: cztery etapy zaimplementowane i zweryfikowane lokalnie; odbiór rzeczywistego telefonu i Supabase pozostaje do wykonania.

## Mobilne UI i UX — plan z 30 września 2026

[Plan poprawy mobilnego UI i UX](./2026-09-30-mobile-ui-ux-plan.md)
obejmuje cały produkt, ze szczególnym naciskiem na prostotę codziennych czynności.
Zawiera obserwacje lokalnego demo, priorytety, kierunek wyglądu, specyfikację
animacji, sześć etapów wdrożenia i kryteria odbioru. Uwzględnia istniejące lokalne
zmiany oraz wcześniejsze plany. Status: propozycja; bez zmian implementacji.

## Wiedza i krótkie notatki — plan z 27 września 2026

[Plan wykonawczy Wiedzy i krótkich notatek](./2026-09-27-knowledge-short-notes-implementation.md)
opisuje naprawy filtrów i paginacji, zapis notatki z jednym wymaganym polem,
ochronę szkiców, notatki przy książkach i kryteria odbioru. Zawiera mapę kodu,
reguły kompatybilności oraz gotowe polecenie dla kolejnego modelu.
Status: etapy A–E zaimplementowane i sprawdzone lokalnie, migracja filtrów Wiedzy wdrożona; etap F odłożony.

## Szablony Projektów i Czytelnia — plan z 26 września 2026

[Plan wdrożenia szablonów i Czytelni](./2026-09-26-project-presets-and-reading-library.md)
opisuje jeden szablon prezentacji na Projekt, propozycje z kategorii, książkę jako
odmianę Materiału oraz notatki ze źródłem. Zawiera pięć etapów pierwszego wydania,
integrację z Celami, Działaniami i Startem, migrację danych oraz kryteria odbioru.
Status: etapy 1–5 zaimplementowane lokalnie; lint, typecheck, testy i build
przechodzą. Dwie migracje wdrożone do podłączonego Supabase, historia i RPC
zweryfikowane, lista Wiedzy ładuje się w przeglądarce. Demo zachowało wcześniejszy
snapshot bez przykładowej Czytelni; etap 6 nierozpoczęty.

## Podsumowanie tygodnia i Przegląd AI — plan z 25 września 2026

[Plan wykonawczy poprawy Podsumowania](./2026-09-25-weekly-review-improvements-handoff.md)
opisuje ustawienia zakresu analizy i czasu cache, nawigację do zakładki AI, aktualność wyniku,
uproszczenie sugestii i zapisu tygodnia oraz kryteria jakości analizy.
Status: do wdrożenia, bez zmian funkcjonalnych w ramach samego planu.

## Płatne OpenAI API — plan z 24 września 2026

[Plan podłączenia OpenAI API](./2026-09-24-openai-api-integration.md) opisuje
adapter dla obecnych funkcji AI, zgodny z nimi kontrakt, kontrolę kosztu,
staging, odbiór i możliwość wycofania. Status: implementacja lokalna ukończona;
konfiguracja klucza i próby na stagingu pozostają do wykonania.

## Nowe funkcje — plan z 23 września 2026

[Plan rozwoju funkcjonalnego: od decyzji do działania](./2026-09-23-functional-improvements-plan.md)
opisuje plan tygodnia, powrót do blokady, podpowiedzi istniejącej Wiedzy,
ulubione widoki oraz warunkowe powtórki nauki. Zawiera kolejność, pierwsze
wersje, zależności, kryteria odbioru i ryzyka.
Status: propozycja, implementacja nierozpoczęta.

## Czytelne Działania — plan z 20 września 2026

[Plan wdrożenia spójnych i czytelnych Działań](./2026-09-20-actions-experience-remediation.md)
zamyka dziewięć problemów wykrytych na liście, szczególe, Starcie, w Projekcie,
Celu i Quick Add. Obejmuje wspólną prezentację statusu, daty, blokady i Rutyny,
edycję ze szczegółu, kolejność wdrożenia, testy oraz kryteria odbioru.
Status: panel intencji, wybór źródeł i eksport Markdown/JSON zaimplementowane lokalnie. Migracja oczekuje na wdrożenie; instrukcja Projektu i MCP pozostają do realizacji.

## Kierunek od AI na ekranie Start — plan z 19 września 2026

[Plan wdrożenia podsumowania AI na ekranie Start](./2026-09-19-ai-start-guidance-implementation.md)
zastępuje `Dalszy plan` kompaktowym kierunkiem opartym na istniejącym
`AIGoalReview`. Zachowuje liczby jako zwijane sygnały, ponownie wykorzystuje
zgodę, cache i bezpieczne zatwierdzanie szkicu Działania oraz nie wymaga nowego
endpointu ani migracji w MVP.
Status: wdrożone lokalnie, gotowe do odbioru.

## Kontekst dla AI — plan z 14 września 2026

[Plan wdrożenia kontekstu dla AI](./2026-09-14-ai-context-implementation.md)
obejmuje dwa wydania: panel z eksportem Markdown/JSON i wskazówkami projektu,
a następnie uwierzytelniony odczyt przez MCP. Zawiera kontrakt danych, reguły
doboru źródeł, cztery etapy, testy i kryteria odbioru.
Status: zaplanowane, implementacja nierozpoczęta.

## „Dodaj” na telefonie — plan z 11 września 2026

[Plan wdrożenia „Dodaj” — mobile](./2026-09-11-dodaj-mobile-plan.md)
obejmuje sześć etapów: poprawność zapisu, szkice, mobilny panel i klawiaturę,
wspólne formularze, podłączenie wszystkich wejść i odbiór na urządzeniach.
Podstawą jest [aktualny audyt](./2026-09-11-dodaj-mobile-audit.md).
Status: zaplanowane, implementacja nierozpoczęta.

## Zadania gotowe do przekazania czatowi

[Najważniejsze wdrożenia — pakiet z 8 września 2026](./priority-implementation-2026-09-08/README.md)
rozpisuje priorytety audytu na 9 osobnych planów. Zawiera kolejność, zależności,
zakres, kryteria odbioru i gotowe polecenia dla czatu wykonującego. Domyślny
pakiet obejmuje plany 01–07 i odbiór 09; capture offline (08) jest opcjonalny.

## Najnowszy przegląd możliwości rozwoju

[Audyt funkcjonalny i wizualny — 7 września 2026](./product-roadmap-audit-2026-09-07.md)
zawiera 32 propozycje z priorytetami, zależnościami, kryteriami odbioru i ryzykami.
Rozróżnia istniejące funkcje, niezamkniętą weryfikację oraz nowe pomysły; rozlicza
też zakres wcześniejszych planów 01–06. To punkt wejścia do wyboru kolejnych
prac, przy zachowaniu dotychczasowych decyzji domenowych.

## Aktywny kierunek

Fundament bezpieczeństwa zapisu, draftów, undo i potwierdzania ryzykownych
operacji jest już obecny. Dalszy rozwój nie kontynuuje modelu
`Commitment → Focus Session → Checkpoint`.

Zamknięty audyt użyteczności mobilnej znajduje się w dokumencie
[Plan poprawek mobilnych i produktywności](./mobile-productivity-remediation-2026-08-19.md)
i służy już tylko jako historia decyzji. Bieżące prace prowadzone są według
krótkich planów wdrożeniowych, w tym [uproszczenia szczegółu Celu i języka](./plan-05-goal-detail-and-language.md).

Plan pierwszego pionu AI, z bezpiecznym adapterem NVIDIA API/NIM, znajduje się w
dokumencie [AI z obsługą NVIDIA](./nvidia-ai-implementation.md). Zaczyna od
tylko-do-odczytu przeglądu wszystkich aktywnych Celów i rekomendacji na kolejny
tydzień. Mechanizm `AIProposal → approval → AIExecution` pozostaje przewidziany
dopiero dla późniejszych funkcji wykonujących mutacje.

Aktualnym źródłem decyzji produktowych jest dokument
[Trwałe Projekty i proste Cele](./project-centered-hierarchy.md). Wcześniejszy
dokument [Cele, działania cykliczne i wiedza](./goal-centric-redesign.md)
pozostaje zapisem etapu przejściowego.

## Kolejność realizacji

Wcześniejsze poprawki wynikające z audytu interfejsu są rozpisane w
[backlogu technicznym UI/UX](./ui-ux-remediation-backlog.md). Backlog obejmuje
15 sprawdzonych kroków, zależności, kryteria akceptacji oraz podział AFK/HITL.

Każdy nowy sprint musi zakończyć się działającym pionowym przepływem w trybie
demo i Supabase. Nie wolno rozpoczynać kolejnego sprintu, dopóki migracja,
testy regresji i checkpointy HITL bieżącego sprintu nie są zamknięte.

## Znaczenie typów ticketów

- `AFK` — ticket może zostać zaimplementowany i zweryfikowany samodzielnie.
- `HITL` — implementacja powstaje w całości, ale zamknięcie wymaga krótkiej
  decyzji człowieka dotyczącej języka, hierarchii lub przebiegu.

## Stałe zasady nowego produktu

- Projekt jest trwałym kontenerem dla Celów, Zadań i Wiedzy.
- Cel jest prostym, możliwym do zamknięcia rezultatem i może należeć do Projektu.
- Działanie może być pojedyncze albo pochodzić z szablonu cyklicznego.
- Wykonanie działania nie wymaga timera ani Focus Session.
- Projekty, szablony celów i szablony cykliczne mogą być tworzone przez
  użytkownika.
- Wiedza działa globalnie i może być łączona z Projektami, Celami i Działaniami.
- Inbox zachowuje oryginalny capture niezależnie od wyniku triage.
- Historycznych Focus Sessions i Checkpointów nie usuwamy; pozostają do odczytu
  i w eksporcie, ale nowe nie są tworzone.
- Każda mutacja przechodzi przez typowaną, idempotentną komendę.
- Każda tabela w publicznym schemacie ma RLS, jawne granty i izolację
  Workspace'u.
- Managed Supabase pozostaje backendem docelowym, a tryb demo implementuje ten
  sam kontrakt.

## Wspólna Definition of Done

Ticket jest zakończony, gdy:

- dostarcza pełną ścieżkę użytkownika, a nie samą warstwę techniczną;
- tryb demo i Supabase zachowują się zgodnie;
- migracja jest addytywna, odtwarzalna i ma testy liczników oraz RLS;
- sukces, loading, empty, error i retry są jawne;
- operacje odwracalne oferują undo, a nieodwracalne bezpieczne potwierdzenie;
- desktop, mobile i klawiatura mają działającą podstawową ścieżkę;
- test obejmuje sukces, błąd i co najmniej jedną granicę domenową;
- `pnpm lint`, `pnpm typecheck`, `pnpm test` i build demo przechodzą;
- agent nie wdraża migracji zdalnie, nie tworzy commita i nie usuwa danych bez
  osobnego polecenia.

## Wskaźniki końcowe

- pierwszy Cel i Działanie w mniej niż 3 minuty;
- zwykłe Działanie można ukończyć jednym kliknięciem, bez rozpoczynania sesji;
- działanie cykliczne można utworzyć w mniej niż minutę;
- powrót po dłuższej przerwie nie tworzy lawiny zaległych wystąpień;
- własny Projekt i szablon nie wymagają zmiany kodu;
- capture tekstu lub linku trwa mniej niż 15 sekund;
- każdy historyczny Project, Learning Goal i Work Item jest dostępny po
  migracji jako Cel albo Działanie;
- aktywny interfejs nie używa pojęć Focus Session, Commitment, Work Item,
  Checkpoint ani Learning Evidence.
