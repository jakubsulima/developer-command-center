# Sprint 4 — Wiedza, Inbox i domknięcie redesignu

## Cel sprintu

Wiedza i Inbox zostają podporządkowane Celom oraz Działaniom bez utraty swojej
samodzielności. Użytkownik może szybko przechwycić treść, zamienić ją w właściwy
obiekt, powiązać materiały z wieloma kontekstami i korzystać z lekkiego
przeglądu celów jako opcjonalnego działania cyklicznego. Aktywny interfejs nie
zawiera już Focus Session ani starej terminologii.

## Rezultat demonstracyjny

Na telefonie użytkownik przechwytuje link, przetwarza go jako Resource i łączy
z dwoma Celami. Drugą notatkę zamienia w Działanie istniejącego Celu i przypina
do Dzisiaj. Z poziomu Celu wyszukuje materiał, zapisuje aktualizację postępu i
kończy tygodniowy przegląd utworzony jako zwykła seria cykliczna. Wszystkie
historyczne dane są nadal dostępne w archiwum i eksporcie.

## Poza zakresem

- automatyczny triage bez zatwierdzenia;
- autonomiczne zmiany wykonywane przez AI;
- współdzielenie między Workspace'ami;
- pełny edytor blokowy;
- import poczty, kalendarzy i zewnętrznych dysków;
- hard delete historycznych tabel i rekordów Focus;
- przebudowa mechanizmu AI Proposal poza dostosowaniem nazw obiektów.

## Punkty startowe w repozytorium

- `docs/planning/goal-centric-redesign.md`
- `docs/planning/sprint-2-goals-foundation.md`
- `docs/planning/sprint-3-today-recurring-actions.md`
- `apps/web/src/pages/InboxPage.tsx`
- `apps/web/src/pages/KnowledgePage.tsx`
- `apps/web/src/pages/ReviewPage.tsx`
- `apps/web/src/components/QuickCapture.tsx`
- `apps/web/src/components/GlobalSearch.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/data/supabaseRepository.ts`
- `supabase/migrations/`

## G4-01 — Triage Inboxu według intencji

**Typ:** HITL  
**Złożoność:** L  
**Blocked by:** Sprint 2

### Co zbudować

Zastąp techniczny wybór typu pytaniem „Co chcesz z tym zrobić?”. Dostępne
ścieżki to: utwórz Cel, dodaj Działanie, zapisz w Wiedzy, odłóż albo odrzuć.
Każda ścieżka zachowuje oryginalny Inbox Item, źródło i relację pochodzenia.
Operacje tworzące obiekt są atomowe i idempotentne.

### Kryteria akceptacji

- [ ] Pierwszy ekran pokazuje intencje, a nie wewnętrzne typy tabel.
- [ ] Link domyślnie proponuje Resource, ale wybór można zmienić.
- [ ] Nowy Cel wymaga rezultatu, a pierwsze Działanie pozostaje opcjonalne.
- [ ] Działanie wymaga wyboru Celu/Obszaru albo świadomego pozostawienia bez powiązania.
- [ ] Wiedza pozwala wybrać Note, Resource, Decision, Artifact lub Investigation.
- [ ] Oryginalny capture pozostaje dostępny po sukcesie i błędzie.
- [ ] Retry nie tworzy duplikatów ani dwóch relacji pochodzenia.
- [ ] Mobile pokazuje jedną czytelną decyzję na etap.
- [ ] Testy obejmują każdą intencję, rollback i RLS.

### Checkpoint HITL

Pokaż pierwszy krok triage dla tekstu i linku. Oceń nazwy decyzji, liczbę opcji
i czy domyślna sugestia pomaga bez poczucia automatycznej klasyfikacji.

## G4-02 — Szybkie przechwycenie z każdego widoku

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** G4-01, Sprint 1 drafty

### Co zbudować

Centralny przycisk `+` otwiera dostępny sheet/modal capture bez zmiany bieżącej
trasy. Po zapisie użytkownik pozostaje przy Celu, Działaniu albo Wiedzy, z
możliwością przejścia do nowego Inbox Itemu. Draft i idempotency key przetrwają
reload oraz chwilową utratę połączenia.

### Kryteria akceptacji

- [ ] Capture działa z Dzisiaj, Celów, Wiedzy i Inboxu.
- [ ] Zapis nie zmienia trasy ani nie zamyka kontekstu przed potwierdzeniem sukcesu.
- [ ] Draft jest izolowany per User/Workspace i usuwany dopiero po sukcesie.
- [ ] Online retry nie tworzy duplikatu.
- [ ] Przy błędzie użytkownik może ponowić, skopiować lub zachować treść.
- [ ] Focus trap, Escape/back i powrót fokusu działają poprawnie.
- [ ] Kontrolki mieszczą się przy 320 px i uwzględniają safe area.
- [ ] Test obejmuje reload, błąd sieci i zmianę Workspace'u.

## G4-03 — Wiedza powiązana z wieloma Celami i Działaniami

**Typ:** AFK  
**Złożoność:** L  
**Blocked by:** G4-01

### Co zbudować

Ujednolić bibliotekę Note, Resource, Decision, Artifact i Investigation oraz
pozwolić łączyć jeden element z wieloma Celami i Działaniami. Cel i Działanie
pokazują powiązaną Wiedzę w kontekście, a biblioteka pokazuje odwrotne relacje.

### Kryteria akceptacji

- [ ] Element Wiedzy może istnieć bez Celu i mieć wiele relacji.
- [ ] Dodanie i usunięcie relacji nie zmienia ani nie usuwa treści Wiedzy.
- [ ] Widok Celu pokazuje tylko powiązane materiały, decyzje i rezultaty.
- [ ] Widok Działania może otworzyć materiał bez utraty stanu Dzisiaj.
- [ ] Relacja zachowuje typ znaczenia, np. materiał, rezultat albo decyzja.
- [ ] Nie można utworzyć relacji między różnymi Workspace'ami.
- [ ] Operacje oferują undo i są odporne na duplikaty.
- [ ] Testy obejmują wiele Celów, usunięcie relacji, Archive/Trash i RLS.

## G4-04 — Wyszukiwanie po Celach, Działaniach i Wiedzy

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** G4-03

### Co zbudować

Przekształć GlobalSearch w dostępną paletę wyników pogrupowanych na Cele,
Działania, Wiedzę i Inbox. Biblioteka Wiedzy dostaje filtry po typie, Obszarze i
powiązanym Celu. Puste zapytanie pokazuje ostatnie obiekty bieżącego Workspace'u.

### Kryteria akceptacji

- [ ] Wyniki używają nowej terminologii i nie pokazują aktywnych typów legacy.
- [ ] `Ctrl/Cmd+K`, strzałki, Enter, Escape i powrót fokusu działają poprawnie.
- [ ] Role combobox/listbox oraz `aria-activedescendant` odpowiadają stanowi.
- [ ] Filtry Wiedzy można łączyć i odzwierciedlają się w URL.
- [ ] Archive i Trash nie trafiają do domyślnych wyników.
- [ ] Brak wyników oferuje właściwe utworzenie Celu, Działania albo Wiedzy.
- [ ] Zapytania jawnie filtrują po Workspace i mają indeksy pod najczęstsze ścieżki.
- [ ] Testy obejmują klawiaturę, polskie znaki, brak wyników i izolację.

## G4-05 — Przegląd Celów jako opcjonalne Działanie cykliczne

**Typ:** HITL  
**Złożoność:** M  
**Blocked by:** Sprint 3, G4-03

### Co zbudować

Zastąp osobny moduł Review gotowym, nieaktywnym szablonem cyklicznym „Przegląd
celów”. Jego wystąpienie prowadzi przez żywe sygnały: Cel bez następnego
Działania, blocker, przeterminowany termin, stary postęp i pilny Inbox. Decyzje
wykonują zwykłe komendy, a ukończenie tworzy Aktualizację postępu.

### Kryteria akceptacji

- [ ] Szablon nie aktywuje się automatycznie i można go dowolnie zmienić.
- [ ] Przegląd jest zwykłym Działaniem cyklicznym, nie nowym typem domenowym.
- [ ] Każdy sygnał wskazuje źródłowy Cel/Działanie i konkretny powód.
- [ ] Z przeglądu można dodać następny krok, zmienić priorytet, opisać blocker lub odłożyć decyzję.
- [ ] Operacje ryzykowne używają istniejących zabezpieczeń Sprintu 1.
- [ ] Ukończenie zapisuje podsumowanie jako Aktualizację postępu.
- [ ] Historyczne Review pozostają do odczytu i w eksporcie.
- [ ] Testy obejmują brak sygnałów, kilka decyzji, retry i niezmienność historii.

### Checkpoint HITL

Pokaż tygodniowy przegląd z co najmniej trzema różnymi sygnałami. Oceń, czy
wygląda jak pomocnicza rutyna, a nie obowiązkowy rytuał produktywnościowy.

## G4-06 — Archiwum, Trash i odzyskiwanie nowych obiektów

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** G4-03

### Co zbudować

Ujednolić Archive, Trash, undo i widoki odzyskiwania dla Celów, Działań,
Obszarów, szablonów oraz Wiedzy. Archiwizacja serii zatrzymuje generowanie, ale
nie usuwa wystąpień. Trash nie wykonuje hard delete w tym sprincie.

### Kryteria akceptacji

- [ ] Archive zmienia widoczność, nie wynik domenowy obiektu.
- [ ] Trash ma jednoznaczne potwierdzenie skutku i zachowanych danych.
- [ ] Undo korzysta z komendy kompensującej i nie usuwa Activity Event.
- [ ] Archiwizacja Obszaru nie archiwizuje automatycznie Celów.
- [ ] Archiwizacja serii zatrzymuje przyszłą materializację.
- [ ] Przywrócenie obiektu odtwarza jego relacje, o ile cele relacji nadal istnieją.
- [ ] Widoki odzyskiwania są dostępne z odpowiednich filtrów, nie z głównej nawigacji.
- [ ] Testy obejmują serię, relacje Wiedzy, częściowy błąd i izolację Workspace.

## G4-07 — Usunięcie aktywnego Focus i starej terminologii

**Typ:** HITL  
**Złożoność:** L  
**Blocked by:** G4-02, G4-04, G4-05, G4-06

### Co zbudować

Domknij redesign: główna nawigacja zawiera wyłącznie Dzisiaj, Cele, Wiedzę i
Inbox; mobile ma te same intencje oraz centralny capture. Usuń aktywną trasę
Focus, timery, przyciski start/pauza i formularze checkpointu. Stare URL-e
prowadzą do odpowiedniego Celu, Działania albo historii tylko do odczytu.

### Kryteria akceptacji

- [ ] Aktywny UI nie używa nazw Focus Session, Commitment, Work Item, Checkpoint ani Learning Evidence.
- [ ] `/focus` nie pozwala tworzyć sesji i bezpiecznie przekierowuje do Dzisiaj lub historycznego wpisu.
- [ ] Store i repozytoria nie wywołują komend start/end Focus w nowych przepływach.
- [ ] Timer i zależne hooki nie są ładowane przez aktywne trasy.
- [ ] Historyczne dane Focus pozostają dostępne tylko do odczytu i w eksporcie.
- [ ] Desktop i mobile mają cztery główne intencje oraz dostępny capture.
- [ ] Stare deep linki i zakładki nie kończą się pustym ekranem.
- [ ] Pełny test regresji potwierdza brak tworzenia nowych rekordów Focus/Checkpoint.
- [ ] Dokumentacja, onboarding, screeny i prompty sprintów używają nowego języka.

### Checkpoint HITL

Pokaż końcowy produkt na desktopie i mobile: Dzisiaj, Cele, Wiedzę, Inbox oraz
historię legacy. Poproś o końcową ocenę prostoty i tego, czy aplikacja wspiera
cele bez narzucania konkretnej metody produktywności.

## Kolejność wykonania

1. G4-01
2. G4-02 i G4-03
3. G4-04 i G4-06
4. G4-05
5. G4-07
6. Scenariusz końcowy mobile i desktop od capture do Celu, Dzisiaj i Wiedzy

## Kontrole jakości

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
VITE_DATA_BACKEND=demo pnpm build
pnpm supabase:plan
```

Dodatkowo uruchom pełny test migracji od początkowego schematu, porównaj liczniki
przed i po backfillu, sprawdź RLS wszystkich nowych relacji, eksport, stare deep
linki, 200% zoom, mobile 320 px i obsługę bez myszy. Nie usuwaj tabel legacy ani
nie wdrażaj migracji zdalnie bez osobnej zgody.

## Prompt startowy dla kolejnego chatu

```text
Zrealizuj Sprint 4 opisany w docs/planning/sprint-4-knowledge-inbox-redesign.md.
Przeczytaj cały plan, goal-centric-redesign.md, Sprinty 2–3, CONTEXT.md, aktualne
ADR-y i design system. Zweryfikuj ukończenie wcześniejszych sprintów. Realizuj
pionowe tickety demo + Supabase + UI + testy w kolejności. Zatrzymaj się na HITL
G4-01, G4-05 i G4-07. Nie wykonuj hard delete, nie wdrażaj zdalnie i nie twórz
commita bez osobnego polecenia.
```

