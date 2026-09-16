# Kontekst dla AI — plan wdrożenia

Data: 2026-09-14. Status: plan, implementacja nierozpoczęta.

## Cel i zakres

Użytkownik otwiera Działanie, Cel lub Projekt, dopisuje intencję i otrzymuje
pakiet aktualnego kontekstu do rozmowy z AI. Zewnętrzny asystent może później
odnaleźć te same obiekty i pobierać ich kontekst przez MCP.

Dwa wydania:

1. **Kontekst do skopiowania:** panel, wybór źródeł, Markdown i JSON, trwała
   notatka projektu „Co AI powinno wiedzieć”.
2. **Kontekst pobierany przez AI:** uwierzytelniony odczyt przez MCP i działający
   przepływ w jednym wybranym kliencie obsługującym MCP.

Poza tym zakresem: czat w aplikacji, generowanie podsumowań modelem, embeddings,
automatyczne przeglądy w tle, import treści stron lub załączników, zapisywanie
wyników przez AI i publiczne linki do pakietów. Eksport nie wywołuje modelu.

## Zweryfikowany punkt wyjścia

- `CONTEXT.md`: Projekt jest trwałym kontekstem, Cel rezultatem, Działanie krokiem.
- `apps/web/src/domain/types.ts`: bieżący Projekt korzysta z `Area` / tabeli
  `areas`; nie należy opierać nowej funkcji na historycznych projektach.
- Dostępne dane: opis projektu, wynik i kryteria celu, szczegóły, blocker i
  checklista działania, postęp oraz relacje Wiedzy.
- `apps/web/src/domain/actionContext.ts` rozwiązuje kontekst na potrzeby etykiet
  UI; nie jest kompletnym generatorem pakietu AI.
- `apps/web/src/data/workspaceRepository.ts` udostępnia odczyty stronicowane,
  szczegóły, wyszukiwanie i eksport. Bieżący `AppState` nie gwarantuje kompletu
  materiałów; generator nie może zależeć od odwiedzonych ekranów.
- `supabase/functions/_shared/ai/goal-review-context.ts` ma specjalistyczny
  kontrakt przeglądu celów. Pozostaje oddzielny; wspólne elementy wyodrębniać
  tylko wtedy, gdy faktycznie pasują do obu zastosowań.
- `docs/adr/0006-ai-approval-is-separate-from-execution.md` opisuje przyszłe
  mutacje AI. Odczyt kontekstu nie tworzy AI Proposal ani AI Execution.

## Decyzje projektowe

### Jeden kontrakt, dwa sposoby użycia

Wprowadzić niezależny od Reacta pakiet `packages/ai-context` z typami,
walidacją, regułami selekcji i rendererem Markdown. Adaptery demo, backendu i MCP
korzystają z tego kontraktu. Zweryfikować importy dla Vite i środowiska backendu
zanim powstaną zależne moduły; uniknąć zależności runtime od kodu aplikacji web.

Proponowany kontrakt v1:

```ts
type ContextRequest = {
  target: { type: "action" | "goal" | "project"; id: string };
  intent?: string;
  selection: {
    includeProject: boolean;
    includeGoal: boolean;
    includeProgress: boolean;
    includeKnowledge: boolean;
    extraKnowledgeIds: string[];
    excludedSourceIds: string[];
  };
};

type ContextSource = {
  key: string; // typ + id, bez kolizji między rodzajami rekordów
  type: string;
  id: string;
  title: string;
  route: string;
  updatedAt: string | null;
  version: number | null;
};

type ContextBundle = {
  schemaVersion: 1;
  generatedAt: string;
  workspaceId: string;
  target: ContextRequest["target"];
  intent: string | null;
  sources: ContextSource[];
  sections: ContextSection[]; // typowana unia: zadanie, cel, projekt, wiedza, postęp
  omissions: ContextOmission[]; // źródło/sekcja i przyczyna pominięcia
  completeness: "complete" | "limited";
};
```

Implementacja doprecyzuje unie i walidatory; nie używać dowolnego rekordu JSON
jako ostatecznego typu sekcji. Brak daty lub wersji oznaczać jako `null`, bez
udawania aktualności. Uprawnienia wyznacza sesja użytkownika; `workspaceId`
ani identyfikatory z żądania nie są dowodem dostępu.

### Dobór treści

1. Zawsze obiekt wskazany przez użytkownika i jego bieżący stan.
2. Dla Działania: powiązany Cel i jego Projekt; gdy brak Celu, Projekt Działania.
   Rozbieżne przypisania wykryć i jawnie opisać, zamiast wybierać po cichu.
3. Dla Celu: wynik, kryteria, Projekt i do 20 otwartych Działań; następne
   Działanie pierwsze. Dla Projektu: opis i do 20 aktywnych Celów oraz do 20
   otwartych Działań, bez rozwijania wszystkich ich materiałów.
4. Do 5 ostatnich aktualizacji w wybranym zakresie, preferując aktualizacje
   wskazanego Działania. Sortowanie stabilne: data i id.
5. Do 10 bezpośrednio powiązanych elementów Wiedzy. Ręcznie dodane źródła mają
   pierwszeństwo; dalej bezpośrednie relacje Działania, Celu, Projektu.
6. Deduplikacja po typie i id. Bez rekurencyjnego przechodzenia całego grafu.
7. Domyślnie bez archiwum, kosza, surowej Skrzynki i historycznych sesji.
   Niedostępny obiekt główny kończy odczyt komunikatem; nie ujawniać tytułów
   ani istnienia rekordów z obcego workspace'u.
8. Początkowy budżet treści: 40 000 znaków, w tym intencja do 2 000 znaków.
   Wynik serializowany maksymalnie 256 KiB. Limity egzekwowane także na serwerze.
   Skrócenia oznaczać przy sekcji i w `omissions`; nie deklarować pełnego eksportu.
   Są to limity startowe do oceny na rzeczywistych danych, nie estymacja tokenów.

Link materiału nie oznacza pobrania jego zawartości. Nie wywnioskowywać, że
decyzja została zastąpiona, jeśli model nie przechowuje takiej relacji.
Treści źródeł oddzielić od intencji użytkownika; nie traktować instrukcji
znalezionych w notatkach jako uprawnienia do wykonania operacji.

### Zachowanie panelu

Przycisk „Pracuj z AI” otwiera panel „Kontekst dla AI”. Pole „Co AI ma zrobić?”,
lista dołączonych sekcji i materiałów, „Dodaj materiał”, podgląd oraz akcje:
„Kopiuj dla AI”, „Pobierz Markdown”, „Pobierz JSON”. Brak fikcyjnego przycisku
wysyłania do asystenta, dopóki nie ma integracji.

Podgląd i eksport korzystają z dokładnie tego samego pakietu. „Odśwież kontekst”
pobiera nowe dane, zachowując intencję i wybory. Zmiana targetu resetuje wybory;
zmiana workspace'u czyści panel i roboczy tekst. Intencja pozostaje tylko
w pamięci panelu, nie zapisuje się automatycznie w bazie ani logach.

## Etapy wdrożenia

### 1. Działający eksport Działania

**Zakres:** pakiet kontraktu, generator, renderery, odczyt kontekstu przez
repozytorium demo i Supabase oraz minimalny panel w `ActionDetailPage.tsx`.
Dodać dedykowany odczyt backendowy z ograniczonymi zapytaniami, autoryzacją i
spójnym snapshotem danych; nie pobierać pełnego eksportu workspace'u.
Jeżeli użyte będzie RPC, zachować `security invoker`, RLS i jawne granty.

**Odbiór:** otwarcie Działania bez wcześniejszego odwiedzania Celu lub Wiedzy
daje komplet kontekstu w zadanym zakresie. Działanie samodzielne działa.
Kopiowanie i pobranie odtwarzają podgląd. Błąd schowka oferuje zaznaczenie
tekstu lub pobranie pliku. Odczyt obcego workspace'u nie zwraca danych.

**Testy:** selekcja, deduplikacja, brak rodzica, konflikty relacji, limity,
zgodność adapterów, autoryzacja i podstawowy przepływ UI. Dane większe niż
jedna strona listy muszą być częścią testu.

### 2. Wybór kontekstu i wejścia z Celu oraz Projektu

**Zależność:** etap 1.

**Zakres:** wspólny panel w `GoalDetailPage.tsx` i `ProjectDetailPage.tsx`,
checkboxy sekcji i poszczególnych źródeł, wyszukiwanie dodatkowej Wiedzy,
informacja o pominięciach, odświeżanie i zakres odpowiedni do typu targetu.
Ponownie wykorzystać istniejące komponenty paneli i wyszukiwania.

**Odbiór:** użytkownik może usunąć automatycznie dołączony materiał i dodać
inny z własnego workspace'u. Wykluczone treści nie pojawiają się w eksporcie
ani ponownie przez inną relację. Desktop, telefon i klawiatura obsługują
pełną ścieżkę; loading, pusty wynik, błąd i retry są jawne.

**Testy:** selekcja a eksport, nieaktualna odpowiedź po zmianie targetu,
odświeżenie, pusty Projekt i duży Projekt, błąd i ponowienie odczytu.

### 3. Trwałe wskazówki projektu i odbiór wydania 1

**Zależność:** etap 2.

**Zakres:** opcjonalne `aiContextNote` projektu, limit 4 000 znaków, pole
„Co AI powinno wiedzieć” w edycji Projektu. Addytywna migracja `areas`,
typowana komenda i mapowanie w obu repozytoriach, uwzględnienie w eksporcie
workspace'u. Brak osobnej tabeli pamięci AI. Notatka jest widoczna i możliwa
do wyłączenia w pakiecie.

**Odbiór:** zapis, ponowne otwarcie, edycja i wyczyszczenie działają w obu
backendach; błąd zapisu nie gubi wpisanej treści. Eksport projektu i jego
Działania dziedziczy notatkę bez kopiowania jej do rekordów potomnych.

**Testy:** zapis i odczyt, limit, RLS, eksport, regresja edycji projektu.
Zamknąć pełny scenariusz: otwórz Działanie → dopisz intencję → zmień źródła
→ skopiuj → wklej do rozmowy i oceń, czy da się zrozumieć zadanie bez dopowiedzeń.

### 4. MCP tylko do odczytu i odbiór wydania 2

**Zależność:** wydanie 1. To osobne wydanie, nie warunek używania eksportu.

**Początek etapu:** sprawdzić aktualną dokumentację MCP, SDK i możliwości
docelowego klienta. Wybrać jeden klient do odbioru na podstawie środowiska
użytkownika. Ustalić i zapisać w ADR hosting oraz pełny przepływ logowania.
Preferowany kierunek: zdalny MCP przez Streamable HTTP, OAuth dla klienta,
powiązanie tożsamości z użytkownikiem aplikacji i sesja respektująca RLS.
Zweryfikować kompatybilność przed wdrażaniem narzędzi; bez zakładania, że
token klienta MCP jest automatycznie poprawnym tokenem Supabase.

**Narzędzia v1:**

| Narzędzie | Wynik |
| --- | --- |
| `search` | Stronicowane trafienia: typ, id, tytuł, krótki opis, link |
| `get_action_context` | Wspólny pakiet Działania |
| `get_goal_context` | Wspólny pakiet Celu |
| `get_project_context` | Wspólny pakiet Projektu |
| `get_knowledge` | Ograniczona treść jednego materiału ze źródłem i datą |

Każdy odczyt sprawdza użytkownika i workspace. Walidować parametry,
egzekwować limity, obsłużyć wygasłą sesję i ograniczyć częstotliwość żądań.
Logować metadane wyniku i czas, bez treści notatek i tokenów. Tokenów
uprzywilejowanej bazy nie przekazywać klientowi ani modelowi. Opisy narzędzi
wyjaśniają zakres, ograniczenia i sposób doczytania brakujących materiałów.

**Odbiór:** zaloguj klienta → poproś o odnalezienie zadania → pobierz kontekst
→ doczytaj materiał. Po zmianie Działania ponowny odczyt pokazuje nowy stan.
Wygaśnięcie lub cofnięcie dostępu blokuje kolejne odczyty zgodnie z opisaną
polityką tokenów. Klient nie ma żadnego narzędzia mutującego.

**Testy:** protokół i schematy, błędne parametry, obcy workspace, token
wygasły/cofnięty, duże odpowiedzi i limit żądań. Przeprowadzić rzeczywisty
test w wybranym kliencie; sam test endpointu nie zamyka etapu.

## Kontrole, wydanie i wycofanie

- Każdy etap to osobny, reviewowalny PR z pełnym przepływem demo i Supabase.
- Wykonać `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `VITE_DATA_BACKEND=demo pnpm build` i `pnpm check:bundle`.
  Po dodaniu pakietu objąć go jawnymi skryptami kontroli; obecne skrypty root
  filtrują wyłącznie aplikację web.
- Migracje muszą mieć izolowane testy i próbę na stagingu przed produkcją.
  Zdalne wdrożenie jest osobnym działaniem od przygotowania implementacji.
- Sprawdzić autoryzowany odczyt na stagingu; demo nie dowodzi poprawności RLS.
- Wydanie 1 można wycofać przez ukrycie wejść do panelu, pozostawiając
  addytywne pole notatki. Wydanie 2 przez wyłączenie MCP i cofnięcie jego
  dostępu, bez wyłączania eksportu ręcznego.
- Zmiany w istniejącym przeglądzie celów i triage AI nie należą do wdrożenia.

## Późniejsze rozszerzenia

Po sprawdzeniu obu wydań: przyjmowanie aktualizacji postępu lub propozycji
Działań przez AI, z podglądem i mechanizmem Proposal → approval → Execution.
Oddzielnie można zaplanować czat wewnętrzny i przeglądy cykliczne. Sam MCP
umożliwia pobranie kontekstu podczas pracy asystenta; nie uruchamia go w tle.

## Referencje

- [Model domenowy](../../CONTEXT.md)
- [Approval AI i wykonanie](../adr/0006-ai-approval-is-separate-from-execution.md)
- [Dotychczasowy plan AI](./nvidia-ai-implementation.md)
- [MCP — pojęcia serwera](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/docs/2026-07-28/learn/server-concepts.mdx)

Przed implementacją etapu MCP sprawdzić bieżące wydanie specyfikacji i SDK;
ten plan ustala zachowanie produktu, nie zamraża wersji protokołu.
