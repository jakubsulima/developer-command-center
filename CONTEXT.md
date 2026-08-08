# Developer Command Center

Kontekst osobistego systemu prowadzenia pracy i nauki, który ogranicza koszt
odzyskiwania kontekstu i pomaga doprowadzać rozpoczęte rzeczy do wyniku.

## Current language — Projects as persistent contexts

**Project / Projekt**:
Trwały, własny kontekst pracy, który grupuje Cele, Zadania i Wiedzę. Projekt
nie ma jednego warunku ukończenia; można go archiwizować, ale nie „osiąga się”
go tak jak Celu. W bieżącym modelu danych jest addytywnie oparty na tabeli
`areas`, aby zachować istniejące rekordy i relacje.
_Avoid_: Goal, one-off outcome, temporary task list

**Goal / Cel**:
Prosty, możliwy do zamknięcia rezultat. Cel może należeć do jednego Projektu
albo pozostać samodzielny; nie jest nadrzędnym kontenerem całej pracy.
_Avoid_: Project, Area, Workspace, permanent responsibility

**Action / Działanie**:
Konkretny krok możliwy do utworzenia, zaplanowania, zablokowania, ukończenia,
pominięcia lub anulowania bez uruchamiania timera.
_Avoid_: Work Item, Focus target, Session task

**Area / Obszar**:
Techniczna nazwa rekordu używanego jako trwały Projekt. Nie jest eksponowana
w aktywnym interfejsie; pozostaje w schemacie dla kompatybilności.
_Avoid_: user-facing module, Goal

**Goal Template / Szablon Celu**:
Edytowalna kopia języka rezultatu, kryteriów i proponowanych Działań. Szablon
systemowy jest wyłącznie propozycją i nigdy nie aktywuje Celu automatycznie.

**Recurring Action / Działanie cykliczne**:
Szablon serii materializujący zwykłe Działania według jawnej reguły i strefy
czasowej. Wystąpienie można zmienić lub ukończyć bez zmiany serii.

**Progress Update / Aktualizacja postępu**:
Krótka notatka, decyzja, rezultat, dowód albo blocker na osi czasu Celu.

**Knowledge / Wiedza**:
Samodzielna biblioteka Notatek, Materiałów, Decyzji, Rezultatów i Poszukiwań.
Jeden element może mieć wiele relacji z Celami, Działaniami i seriami.

**Today / Dzisiaj**:
Projekcja Działań zaplanowanych, zaległych i świadomie przypiętych. Nie jest
planem, sesją pracy, timerem ani osobnym stanem domenowym.

**Inbox Item**:
Zachowana koperta surowego przechwycenia. Triage zaczyna się od intencji:
utwórz Cel, dodaj Działanie, zapisz w Wiedzy, odłóż albo odrzuć.

**Archive** i **Trash**:
Odwracalne stany widoczności niezależne od osiągnięcia, ukończenia lub
porzucenia obiektu. W bieżącym redesignie nie wykonujemy hard delete.

**Focus Session, Context Checkpoint, Work Item, Commitment, Learning
Goal, Learning Evidence i Review** są terminami historycznymi. Ich rekordy
pozostają w eksporcie i widokach tylko do odczytu, ale nowe przepływy ich nie
tworzą i aktywny UI ich nie używa.

## Historical language — schema compatibility only

**User**:
Osoba posiadająca tożsamość w systemie i korzystająca z jednej lub wielu
odizolowanych przestrzeni.
_Avoid_: Account, Owner

**Workspace**:
Twarda granica własności, wyszukiwania, kontekstu AI i dostępu do wszystkich
znajdujących się w niej danych.
_Avoid_: Folder, Account, Space

**Membership**:
Relacja przyznająca jednemu **Userowi** dostęp do jednego **Workspace'u**.
_Avoid_: Access, User Workspace

**Context Checkpoint**:
Zapis minimalnego kontekstu potrzebnego do bezpiecznego wznowienia przerwanej
pracy.
_Avoid_: Evidence, Progress Update, Session Summary

**Learning Evidence**:
Niezmienny zapis konkretnej próby i jej oceny względem kryterium Learning Goal.
_Avoid_: Evidence, Completed Lesson, Learning Progress

**Artifact**:
Wytworzony lub zmieniony rezultat pracy, który można wskazać i sprawdzić.
_Avoid_: Resource, Learning Evidence, Activity Event

**Inbox Item**:
Zachowywana koperta surowego capture, z której triage tworzy lub łączy właściwe
obiekty domenowe.
_Avoid_: Note, Work Item, Draft Project, Notification

**Archive**:
Odwracalny stan widoczności ukrywający obiekt z bieżącej pracy bez zmiany jego
wyniku domenowego.
_Avoid_: Trash, Delete, Completed, Abandoned

**Trash**:
Tymczasowy obszar odzyskiwania obiektów jawnie przeznaczonych do usunięcia.
_Avoid_: Archive, Discarded, Hard Delete

**Focus Session**:
Ciągły przedział świadomie rozpoczętej pracy nad jednym Work Itemem, bez przerw
i późniejszego wznawiania tego samego rekordu.
_Avoid_: Learning Session, Work Session, Timer Session

**Session Scratchpad**:
Robocza treść należąca do jednej Focus Session, niewidoczna globalnie bez
świadomej promocji.
_Avoid_: Note, Context Checkpoint, Learning Evidence

**Project**:
Ograniczone przedsięwzięcie prowadzące do zdefiniowanej zmiany lub rezultatu.
_Avoid_: Area, Goal, Investigation

**Outcome**:
Obserwowalna zmiana wraz z warunkiem pozwalającym uznać Project za zakończony.
_Avoid_: Project, Output, Work Item, Metric

**Requirement**:
Potrzeba, ograniczenie albo obserwowalne zachowanie, które Outcome jednego
Projectu ma spełnić.
_Avoid_: Project, Work Item, Idea, Acceptance Evidence

**Area**:
Trwały obszar odpowiedzialności, który nie ma warunku ukończenia.
_Avoid_: Project, Workspace, Skill

**Work Item**:
Konkretna fizyczna akcja, którą można świadomie wykonać podczas jednej lub wielu
sesji pracy.
_Avoid_: Project, Requirement, Vague Task, Next Step Text

**Commitment**:
Świadome dopuszczenie jednego ukształtowanego rezultatu do aktywnej pracy w
ramach opcjonalnego limitu inwestowanej pracy.
_Avoid_: Plan, Priority, Status, Schedule

**Primary Commitment**:
Aktywny Commitment wskazujący najważniejszy obecnie kierunek pracy w jednym
Workspace.
_Avoid_: Focus Session, Work Item, Pinned Project, Priority Number

**Effort Budget**:
Opcjonalny limit skupionej pracy przypisany do Commitmentu, po którego
wykorzystaniu rezultat wymaga ponownej oceny.
_Avoid_: Appetite, Estimate, Deadline, Work Item Duration

**Investigation**:
Ograniczone badanie prowadzące do odpowiedzi na konkretne pytanie albo redukcji
określonej niepewności.
_Avoid_: Research Topic, Project, Learning Goal

**Conclusion**:
Aktualna, oparta na źródłach odpowiedź Investigation wraz z jawnym poziomem
pewności.
_Avoid_: Finding, Decision, Note

**Note**:
Robocza lub referencyjna treść, która nie stanowi jeszcze odpowiedzi ani wyboru
kierunku.
_Avoid_: Conclusion, Decision, Resource

**Resource**:
Materiał źródłowy wykorzystywany podczas pracy, badania albo nauki.
_Avoid_: Note, Conclusion, Artifact

**Decision**:
Jawny wybór kierunku działania wraz z uzasadnieniem wynikającym z dostępnej
wiedzy.
_Avoid_: Conclusion, Plan, Requirement

**Review**:
Niezmienny zapis świadomego przeglądu zakończonego jawnym potwierdzeniem decyzji
lub braku zmian.
_Avoid_: Report, Dashboard, Review Card, Plan

**Activity Event**:
Niezmienny zapis udanej komendy zmieniającej stan domeny, używany do audytu i
timeline'u, ale nie do odtwarzania stanu systemu.
_Avoid_: Event-sourcing Event, Analytics Event, Diagnostic Log

**AI Proposal**:
Wygasająca propozycja jednej atomowej komendy lub spójnego batcha, którą AI
przedstawia Userowi do niezależnej decyzji.
_Avoid_: AI Execution, Draft Decision, Chat Message, Autonomous Action

**AI Execution**:
Osobny zapis próby wykonania zatwierdzonej AI Proposal po ponownej autoryzacji i
walidacji aktualnego stanu.
_Avoid_: AI Proposal, Activity Event, Tool Call Preview

**Learning Goal**:
Mierzalny rezultat nauki opisujący wiedzę lub umiejętność, którą użytkownik ma
potrafić zademonstrować.
_Avoid_: Learning Topic, Skill, Course

**Skill**:
Trwała zdolność rozwijana przez kolejne cele i dowody, bez definitywnego stanu
ukończenia.
_Avoid_: Learning Goal, Topic, Progress Bar

## Current relationships

- Wszystkie rekordy należą do jednego Workspace'u; złożone klucze obce i RLS
  blokują relacje między Workspace'ami.
- Projekt jest trwałym kontenerem dla Celów, Działań i Wiedzy.
- Cel może opcjonalnie należeć do jednego Projektu i powstać z jednego Szablonu.
- Działanie może wskazywać Cel, Projekt albo pozostać samodzielne.
- Cel może mieć najwyżej jedno następne, gotowe do pracy Działanie.
- Ukończenie Działania nie wymaga i nie tworzy Focus Session ani Checkpointu.
- Działanie cykliczne przechowuje regułę, strefę, politykę zaległości i
  checklistę; każde wystąpienie jest zwykłym Działaniem.
- Para `(recurring_template_id, occurrence_date)` jest unikalna.
- `skip_missed` jest domyślną polityką; `carry_one` tworzy najwyżej jeden zaległy
  rekord po przerwie.
- Wiedza może istnieć bez powiązań i łączyć się z Projektami, Celami, Działaniami
  albo seriami bez zmiany własnej treści.
- Aktualizacja postępu może wskazać Działanie i Wiedzę.
- Projecty i Learning Goals są addytywnie backfillowane do Celów z tymi samymi
  identyfikatorami. Stare tabele nie są usuwane ani nadpisywane.
- Historyczne Focus Sessions, Checkpointy, Learning Evidence i Reviews są tylko
  do odczytu i pozostają w eksporcie.

## Historical relationships — superseded active product rules

- W MVP jeden **User** posiada dokładnie jeden prywatny **Workspace**.
- W MVP prywatny **Workspace** ma dokładnie jeden **Membership** właściciela.
- Wyszukiwanie i kontekst AI nigdy nie łączą danych z różnych **Workspace'ów**.
- Dane nie są przenoszone między **Workspace'ami** w MVP.
- Zatrzymanie pracy tworzy **Context Checkpoint** potrzebny do jej wznowienia.
- **Context Checkpoint** wymaga wyłącznie aktualnego stanu i następnej fizycznej
  akcji; blocker, branch, plik, URL, Artifact i notatka są opcjonalne.
- **Context Checkpoint** można poprawiać do rozpoczęcia kolejnej **Focus Session**
  dla tego samego **Work Itemu**, po czym staje się niezmienny.
- Draft przygotowany przez AI wymaga zatwierdzenia **Usera**.
- Scratchpad sesji nie staje się automatycznie **Note** ani **Context
  Checkpointem**.
- **Session Scratchpad** jest zachowywany z sesją, ale nie jest osobnym obiektem,
  nie pojawia się domyślnie w Knowledge ani globalnym wyszukiwaniu.
- AI może używać **Session Scratchpadu** podczas bieżącej sesji i tworzenia
  draftu checkpointu, ale nie w późniejszym kontekście bez promocji.
- Fragment **Session Scratchpadu** można promować do **Note**, **Inbox Itemu**,
  **Decision** albo **Context Checkpointu**, zachowując oryginał przy sesji.
- **Session Scratchpad** nie jest automatycznie **Learning Evidence**.
- Praca realizująca cel nauki może wytworzyć zarówno **Learning Evidence**, jak
  i **Context Checkpoint**.
- **Learning Evidence** nie zastępuje **Context Checkpointu**.
- **Focus Session** może utworzyć najwyżej jeden **Context Checkpoint** i dowolną
  liczbę **Learning Evidence**.
- Jedna **Focus Session** może jednocześnie wspierać **Project**,
  **Investigation** i **Learning Goal**.
- Każda **Focus Session** realizuje dokładnie jeden **Work Item**.
- Jeden **Work Item** może być realizowany przez wiele **Focus Sessions**.
- **Focus Session** ma stan `running` albo `ended`; zakończenie zapisuje powód,
  np. `paused`, `work_item_completed`, `stopped` albo `interrupted`.
- `Pause` kończy aktualną **Focus Session**, a `Resume` tworzy nową dla tego
  samego **Work Itemu**.
- Jeden **User** może mieć najwyżej jedną uruchomioną **Focus Session** w danym
  **Workspace**.
- Zakończenie sesji z nieukończonym **Work Itemem** wymaga **Context
  Checkpointu**; ukończenie elementu może zakończyć sesję bez checkpointu
  wznowienia.
- Przerwana technicznie sesja wymaga po powrocie uzupełnienia **Context
  Checkpointu** albo oznaczenia jej jako nieważnej.
- **Work Item** ma stan `open`, `in_progress`, `blocked`, `completed` albo
  `cancelled`.
- Pierwsza **Focus Session** zmienia `open` na `in_progress`; jej zakończenie nie
  kończy automatycznie **Work Itemu**.
- `in_focus` jest stanem wyliczanym z trwającej **Focus Session**, a nie stanem
  **Work Itemu**.
- **Work Item** może pozostawać `in_progress` przez wiele sesji i może posuwać
  się naprzód również poza rejestrowaną sesją.
- Długo nieaktywne **Work Items** `in_progress` są sygnałem do Review, ale nie
  zwiększają WIP liczonego przez **Commitments**.
- **Work Item** ma jeden kontekst główny i może dodatkowo wspierać inne
  **Projects**, **Investigations** albo **Learning Goals**.
- Każdy **Commitment** wskazuje dokładnie jeden **Project**, **Investigation**
  albo **Learning Goal**.
- Jeden rezultat może mieć wiele historycznych **Commitments**, ale najwyżej
  jeden otwarty: aktywny albo wstrzymany.
- Aktywne **Commitments** wyznaczają WIP; liczba otwartych **Work Items** go nie
  wyznacza.
- Workspace ma domyślny limit trzech aktywnych **Commitments** i dokładnie jeden
  **Primary Commitment**, jeśli WIP nie jest pusty.
- Wstrzymany **Commitment** nie liczy się do WIP.
- Przekroczenie limitu WIP wymaga świadomego nadpisania z krótkim uzasadnieniem.
- Zwolnienie **Commitmentu** usuwa rezultat z aktywnego WIP, ale go nie usuwa.
- **Commitment** może mieć najwyżej jeden **Effort Budget**, wyrażony czasem
  skupionej pracy albo liczbą sesji.
- **Effort Budget** zużywają tylko **Focus Sessions** realizujące **Work Items**,
  których kontekstem głównym jest rezultat danego **Commitmentu**.
- Konteksty dodatkowe nie zużywają drugiego **Effort Budget** za tę samą sesję.
- Wyczerpanie **Effort Budget** wymaga decyzji o zwiększeniu budżetu, ograniczeniu
  zakresu, wstrzymaniu albo zakończeniu **Commitmentu**.
- **Commitment** ma stan `active`, `paused`, `released` albo `fulfilled`.
- `paused` można wznowić w ramach tego samego **Commitmentu**; `released` zamyka
  go bez osiągnięcia rezultatu, a `fulfilled` po jego osiągnięciu.
- `needs_review` jest wyliczaną flagą, a nie stanem **Commitmentu**.
- Wyłącznie aktywny **Commitment** może być **Primary Commitment**.
- **Project** może należeć do najwyżej jednego **Area**.
- Każdy **Project** ma dokładnie jeden aktualny **Outcome**, który jest jego
  częścią, a nie osobnym obiektem.
- Niezależnie osiągalne **Outcomes** wymagają osobnych **Projects**.
- **Project** nie może zostać zobowiązany do realizacji bez **Outcome** i
  najważniejszych ograniczeń; **Effort Budget** pozostaje opcjonalny.
- **Project** ma stan `draft`, `shaped`, `validating`, `completed` albo
  `abandoned`; aktywność i wstrzymanie wynikają wyłącznie z **Commitmentu**.
- Istotna zmiana **Outcome** przenosi **Project** z `shaped` do `draft`.
- `completed` wymaga osiągnięcia **Outcome** i walidacji wszystkich
  zaakceptowanych **Requirements**; otwarty **Commitment** staje się wtedy
  `fulfilled`.
- `abandoned` kończy **Project** bez osiągnięcia **Outcome**, a jego otwarty
  **Commitment** staje się `released`.
- Archiwizacja **Projectu** zmienia widoczność, a nie jego stan domenowy.
- Każdy **Requirement** należy do dokładnie jednego **Projectu**.
- **Requirement** nie ma własnego planu, **Effort Budget** ani **Focus Sessions**.
- **Work Items**, **Decisions** i rezultaty pracy mogą wskazywać realizowane
  **Requirements**.
- **Requirement** jest zwalidowany dopiero po wskazaniu konkretnego dowodu jego
  spełnienia.
- **Work Item** może mieć **Area** jako kontekst główny, jeśli nie wymaga
  osobnego **Projectu**, **Investigation** ani **Learning Goal**.
- **Area** może być aktywne albo zarchiwizowane, ale nie jest ukończone i nie ma
  procentowego postępu.
- **Skill** opisuje zdolność, a **Area** odpowiedzialność.
- **Learning Evidence** potwierdza albo ujawnia lukę względem **Learning Goal**.
- **Learning Goal** rozwija co najmniej jeden **Skill** i może zostać ukończony
  albo porzucony.
- **Learning Goal** ma stan `draft`, `shaped`, `achieved` albo `abandoned`;
  aktywność i wstrzymanie wynikają wyłącznie z **Commitmentu**.
- `shaped` wymaga co najmniej jednego **Skill** i konkretnego kryterium
  demonstracji, a `achieved` zaakceptowanego **Learning Evidence** spełniającego
  to kryterium.
- `achieved` ustawia otwarty **Commitment** na `fulfilled`, a `abandoned` na
  `released` i wymaga podania powodu.
- Spadek retencji nie cofa historycznego `achieved`; wymaga nowego **Learning
  Goal** dotyczącego powtórki lub wyższego poziomu.
- **Learning Evidence** należy do jednego **Learning Goal** i może wzmacniać
  dowolną liczbę **Skills**.
- **Learning Evidence** ma wynik `supports`, `reveals_gap` albo `inconclusive` i
  zapisuje sposób oceny: self-review, test automatyczny, feedback człowieka albo
  AI.
- **Artifact** może stanowić podstawę **Learning Evidence**, ale nie staje się
  nim bez oceny względem kryterium.
- Czas nauki, ukończenie materiału i streak nie są **Learning Evidence**.
- Ocena AI wymaga akceptacji **Usera**, chyba że kryterium sprawdził
  deterministyczny test.
- Kolejna próba tworzy nowe **Learning Evidence** zamiast zmieniać poprzednie.
- **Inbox Item** zachowuje oryginalną treść, źródło, czas, załączniki i
  transkrypcję również po triage.
- **Inbox Item** ma stan `unprocessed`, `snoozed`, `resolved` albo `discarded`.
- Triage może utworzyć lub powiązać wiele obiektów, ale nie zmienia typu
  **Inbox Itemu**.
- `resolved` zachowuje pochodzenie i możliwość korekty, a `discarded` nie oznacza
  natychmiastowego hard delete.
- Klasyfikacja AI jest propozycją wymagającą decyzji **Usera**.
- Stan domenowy nie usuwa danych ani nie przenosi automatycznie obiektu do
  **Archive** lub **Trash**.
- **Archive** jest odwracalne bez limitu czasu i nie zmienia statusu domenowego.
- Delete przenosi obiekt do **Trash** na 30 dni; przywrócenie odtwarza jego
  relacje, a po okresie retencji następuje hard delete treści i załączników.
- `discarded` **Inbox Item** podlega temu samemu 30-dniowemu okresowi przed hard
  delete.
- **Activity Event** może zachować tombstone identyfikatora usuniętego obiektu,
  ale nie jego treść.
- Usunięcie obiektu nie usuwa po cichu współdzielonego **Artifactu** ani
  **Resource**.
- **Review** ma typ `daily` albo `weekly`; przegląd cykliczny pozostaje poza MVP.
- **Review** używa wersjonowanego szablonu, ale pytanie lub karta szablonu nie
  jest osobnym obiektem domenowym.
- **Review** wykonuje zmiany przez zwykłe komendy domenowe i zapisuje ich wynik,
  zamiast przechowywać własne kopie planów lub zadań.
- Ukończone **Review** jest niezmienne; korekta wymaga nowego przeglądu.
- **Review** może nie wprowadzić zmian, ale wymaga jawnego potwierdzenia tej
  decyzji.
- **Activity Event** zapisuje Workspace, aktora, źródło, typ komendy, czas,
  identyfikatory obiektów, krótki diff oraz correlation lub idempotency key.
- **Activity Event** nie jest osobnym obiektem domenowym i nie podlega edycji ani
  usunięciu przez zwykłe operacje użytkownika.
- Stan systemu nie jest odtwarzany z **Activity Events**; cofnięcie wykonuje nową
  komendę kompensującą.
- **Activity Event** nie zawiera pełnej treści notatek, sekretów ani plików.
- Nieudane próby trafiają do logów diagnostycznych, a odsłony i kliknięcia do
  osobnej analityki produktowej.
- **AI Proposal** zawiera typowane argumenty, preview diffu, źródła, ryzyko,
  oczekiwane wersje rekordów i czas wygaśnięcia.
- **AI Proposal** ma stan `pending`, `approved`, `rejected`, `expired` albo
  `superseded`; edycja tworzy nową propozycję zastępującą poprzednią.
- Zatwierdzenie **AI Proposal** tworzy **AI Execution**, ale nie oznacza udanego
  wykonania.
- **AI Execution** ma stan `queued`, `running`, `succeeded`, `failed` albo
  `cancelled`.
- Przed wykonaniem **AI Execution** ponownie sprawdza uprawnienia, oczekiwane
  wersje i zakres; nieaktualna propozycja wygasa.
- W MVP każda propozycja zapisująca dane wymaga akceptacji **Usera**, niezależnie
  od ryzyka.
- Niezależne zmiany wymagają osobnych **AI Proposals**.
- AI działa domyślnie po jawnej akcji **Usera** i nie skanuje okresowo całego
  **Workspace'u**.
- Automatyczna klasyfikacja nowego **Inbox Itemu** jest jedynym wyjątkiem w MVP i
  wymaga włączenia w ustawieniach **Workspace'u**.
- Przygotowanie **Review** rozpoczyna się dopiero po jego otwarciu przez
  **Usera**.
- Każde wywołanie AI zapisuje manifest celu i identyfikatorów użytego kontekstu.
- Załącznik lub pełna treść **Resource** trafia do modelu tylko wtedy, gdy jest
  potrzebna i widoczna w podglądzie kontekstu.
- **Workspace** może wyłączyć AI, automatyczną klasyfikację i ustawić dzienny
  limit kosztu.
- **Skill** nie ma procentowego ani definitywnego stanu ukończenia.
- **Investigation** może zmniejszyć niepewność **Projectu** i jednocześnie
  wspierać **Learning Goal**.
- **Investigation** ma stan `draft`, `shaped`, `concluded` albo `abandoned`;
  aktywność i wstrzymanie wynikają wyłącznie z **Commitmentu**.
- `concluded` wymaga aktualnej **Conclusion** ze źródłami i poziomem pewności,
  ale nie wymaga utworzenia **Decision**.
- Nowe dowody mogą ponownie otworzyć `concluded` do `shaped`, zachowując
  poprzednią **Conclusion** w historii.
- Istotna zmiana pytania wymaga nowego **Investigation**.
- `abandoned` kończy **Investigation** bez wystarczającej odpowiedzi i wymaga
  podania powodu.
- Aktywne **Investigation** może nie mieć **Conclusion**, ale nie może zostać
  zakończone bez dokładnie jednej aktualnej **Conclusion**.
- **Conclusion** może wskazywać wiele **Resources** i **Notes**.
- **Decision** może wynikać z jednej albo wielu **Conclusions**.
- **Conclusion** nie zobowiązuje do działania; dopiero **Decision** wybiera
  kierunek.
- **Decision** należy do jednego **Workspace** i może być powiązane z wieloma
  **Projects**, **Investigations** i **Requirements**.
- **Decision** zawiera pytanie lub kontekst, wybrany kierunek, uzasadnienie oraz
  opcjonalne alternatywy i źródłowe **Conclusions**.
- Utworzone **Decision** jest niezmienne; zmiana kierunku tworzy nowe Decision
  wskazujące poprzednie jako `superseded`.
- Niedokończone rozważanie jest **Note** albo propozycją AI, nie **Decision**.
- Operacyjne wybory Review i zwykłe zmiany statusów nie tworzą **Decision**.
- AI może przygotować propozycję **Decision**, ale wymaga ona akceptacji
  **Usera**.

## Example dialogue

> **Dev:** „Czy wyszukiwanie w Workspace'ie «Osobiste» może zwrócić notatkę z
> Workspace'u «Klient X»?”
> **Domain expert:** „Nie. Workspace jest granicą danych, a nie folderem ani
> filtrem wyników.”

> **Dev:** „Czy zapis brancha i następnego kroku po debugowaniu jest Learning
> Evidence?”
> **Domain expert:** „Nie. To Context Checkpoint. Learning Evidence powstanie
> dopiero wtedy, gdy rezultat sprawdza wiedzę lub umiejętność.”

> **Dev:** „Implementacja RLS była pracą projektową i nauką. Czy zapisujemy dwie
> sesje?”
> **Domain expert:** „Nie. To jedna Focus Session, która może wytworzyć Learning
> Evidence i Context Checkpoint.”

> **Dev:** „Sprawdzam, czy PowerSync nadaje się do offline, i uczę się
> synchronizacji. Czy to Project czy Learning Goal?”
> **Domain expert:** „Pytanie o PowerSync jest Investigation. Zdobywana zdolność
> jest Learning Goal, a wdrożenie wybranego rozwiązania może należeć do Projectu.”

> **Dev:** „Ukończyłem Learning Goal dotyczący polityk RLS. Czy Skill
> «bezpieczeństwo PostgreSQL» też jest ukończony?”
> **Domain expert:** „Nie. Learning Goal jest skończony, ale Skill pozostaje
> trwałą zdolnością rozwijaną przez kolejne Learning Evidence.”

> **Dev:** „Skończyłem kurs i zapisałem repozytorium. Czy to Learning Evidence?”
> **Domain expert:** „Repozytorium jest Artifactem. Learning Evidence powstanie,
> gdy konkretna próba zostanie oceniona względem kryterium Learning Goal.”

> **Dev:** „Link z Inboxu stał się Resource. Czy usuwamy pierwotny Inbox Item?”
> **Domain expert:** „Nie. Oznaczamy go jako resolved i zachowujemy pochodzenie
> Resource oraz możliwość poprawienia triage.”

> **Dev:** „Project jest completed. Czy powinien trafić do Trash?”
> **Domain expert:** „Nie. Completed opisuje wynik. Możesz osobno przenieść go do
> Archive, a dopiero jawny Delete umieszcza go na 30 dni w Trash.”

> **Dev:** „Investigation wykazało, że PowerSync nie jest potrzebny. Czy to już
> Decision?”
> **Domain expert:** „Nie. To Conclusion. Decision powstanie, gdy wybierzemy na
> tej podstawie konkretny kierunek architektury.”

> **Dev:** „Chcę rozpocząć Focus Session dla całego Projectu «Command Center».”
> **Domain expert:** „Najpierw nazwij konkretny Work Item, na przykład «napisz
> test izolacji dwóch Workspace'ów». Focus Session realizuje właśnie tę akcję.”

> **Dev:** „Sesja się skończyła, ale implementacja wymaga jeszcze dwóch podejść.
> Czy Work Item wraca do open?”
> **Domain expert:** „Nie. Pozostaje in_progress; kolejna Focus Session kontynuuje
> ten sam Work Item.”

> **Dev:** „Wcisnąłem Pause i po godzinie wracam do pracy. Czy wznawiam ten sam
> rekord sesji?”
> **Domain expert:** „Nie. Pause zakończył ciągły przedział z checkpointem;
> Resume rozpoczyna nową Focus Session dla tego samego Work Itemu.”

> **Dev:** „Czy przed pauzą muszę uzupełnić branch, blocker i wszystkie linki?”
> **Domain expert:** „Nie. Wymagane są tylko aktualny stan i następna fizyczna
> akcja; pozostały kontekst jest opcjonalny lub uzupełniany automatycznie.”

> **Dev:** „Zapisałem podczas sesji fragment logu. Czy pojawi się w Knowledge i
> przyszłym kontekście AI?”
> **Domain expert:** „Nie, dopóki świadomie nie wypromujesz go do Note lub innego
> trwałego obiektu.”

> **Dev:** „Weekly Review wstrzymało Commitment. Czy Review przechowuje własną
> kopię jego statusu?”
> **Domain expert:** „Nie. Wykonuje zwykłą komendę domenową i zachowuje odwołanie
> do jej wyniku oraz podsumowanie decyzji.”

> **Dev:** „Zmieniłem Primary Commitment podczas Daily Review. Czy tworzymy
> Decision?”
> **Domain expert:** „Nie. To operacyjna zmiana w Activity Event. Decision
> zapisujemy wtedy, gdy trzeba zachować istotne uzasadnienie kierunku.”

> **Dev:** „Czy cofnięcie zmiany usuwa Activity Event?”
> **Domain expert:** „Nie. Wykonuje nową komendę kompensującą, a oba eventy
> pozostają w historii.”

> **Dev:** „Zatwierdziłem AI Proposal. Czy zmiana jest już zapisana?”
> **Domain expert:** „Nie. Approval dopiero tworzy AI Execution, która ponownie
> sprawdza uprawnienia i aktualność danych, a następnie zapisuje wynik.”

> **Dev:** „Czy lista Work Items zaplanowanych na dziś jest Planem?”
> **Domain expert:** „Nie. To widok aktywnych Commitments i ich bieżących Work
> Items. Commitment określa, co naprawdę weszło do WIP.”

> **Dev:** „Focus Session wspiera Project i Learning Goal. Który Effort Budget
> zużywa?”
> **Domain expert:** „Tylko budżet Commitmentu wskazanego przez główny kontekst
> Work Itemu. Dodatkowe relacje nie naliczają czasu ponownie.”

> **Dev:** „Czy Primary Commitment jest automatycznie celem każdej Focus
> Session?”
> **Domain expert:** „Nie. Wyznacza główny kierunek Workspace'u, ale każda Focus
> Session nadal wskazuje konkretny Work Item.”

> **Dev:** „Czy «rozwój zawodowy» powinien być Projectem?”
> **Domain expert:** „Nie. To Area bez daty ukończenia. Skończony rezultat, taki
> jak «opublikować portfolio», jest Projectem należącym do tego Area.”

> **Dev:** „Project ma dwa rezultaty, z których każdy możemy dostarczyć osobno.”
> **Domain expert:** „To dwa Projects. Jeden Project ma jeden Outcome i może mieć
> wiele kryteriów jego akceptacji.”

> **Dev:** „Zaczynam realizować Requirement. Czy uruchamiam dla niego Focus
> Session?”
> **Domain expert:** „Nie bezpośrednio. Tworzysz konkretny Work Item powiązany z
> Requirementem i to on jest celem Focus Session.”

## Flagged ambiguities

- „Produkt jednoosobowy” i „Workspace zespołowy” wyglądały jak sprzeczne cele —
  rozstrzygnięcie: MVP jest jednoosobowe, ale **Workspace** od początku pozostaje
  granicą umożliwiającą późniejsze członkostwa zespołowe.
- „Evidence” i „Checkpoint” występowały jako zamienne zakończenia głównej pętli —
  rozstrzygnięcie: **Context Checkpoint** utrzymuje ciągłość pracy, a **Learning
  Evidence** potwierdza rezultat nauki.
- `FocusSession` i `LearningSession` dublowały tę samą aktywność —
  rozstrzygnięcie: istnieje jedna **Focus Session**, a nauka jest jej możliwym
  celem i rezultatem.
- „Research” i „Learning” mogły oznaczać ten sam rodzaj aktywności —
  rozstrzygnięcie: **Investigation** redukuje konkretną niepewność, a **Learning
  Goal** określa umiejętność możliwą do zademonstrowania.
- `LearningTopic` mieszał temat, umiejętność i cel — rozstrzygnięcie: temat nie
  jest osobnym obiektem MVP; trwałą zdolność opisuje Skill, a oczekiwany rezultat
  **Learning Goal**.
- „Skill” i „Learning Goal” mogły oznaczać ten sam cel — rozstrzygnięcie:
  **Skill** jest trwały i nieukończalny, a **Learning Goal** jest skończonym,
  sprawdzalnym krokiem jego rozwoju.
- `Finding`, `Conclusion` i `Decision` mogły opisywać ten sam rezultat researchu
  — rozstrzygnięcie: nie ma osobnego Finding; **Conclusion** odpowiada na pytanie
  **Investigation**, a **Decision** wybiera kierunek działania.
- Focus Session mogła wskazywać szeroki Project, Investigation albo Learning Goal
  — rozstrzygnięcie: każda **Focus Session** realizuje dokładnie jeden konkretny
  **Work Item**, a szersze obiekty zapewniają jego kontekst.
- `in_progress` było mylone z aktualnie uruchomioną sesją — rozstrzygnięcie:
  **Work Item** może pozostawać `in_progress` między wieloma sesjami, a
  `in_focus` jest wyłącznie stanem wyliczanym z trwającej **Focus Session**.
- `Pause/Resume` mogło wielokrotnie otwierać ten sam rekord sesji —
  rozstrzygnięcie: **Focus Session** jest ciągłym przedziałem; Pause go kończy z
  checkpointem, a Resume tworzy nową sesję dla tego samego Work Itemu.
- Context Checkpoint groził rozbudowanym obowiązkowym formularzem —
  rozstrzygnięcie: wymagane są tylko aktualny stan i następna akcja, a reszta
  kontekstu pozostaje opcjonalna lub automatyczna.
- Scratchpad mógł zanieczyszczać bazę wiedzy — rozstrzygnięcie: **Session
  Scratchpad** pozostaje lokalną treścią sesji i trafia do globalnego kontekstu
  dopiero po świadomej promocji.
- Review mogło być raportem z własnymi kartami i kopiami danych —
  rozstrzygnięcie: **Review** jest niezmiennym zapisem procesu decyzyjnego, a
  ReviewCard pozostaje wyłącznie wersjonowanym szablonem UI.
- Każda operacyjna decyzja mogła tworzyć domenowe Decision — rozstrzygnięcie:
  **Decision** zachowuje istotne „dlaczego”, jest niezmienne i może zostać tylko
  zastąpione; zwykłe komendy trafiają do Activity Event.
- Activity Event mógł zostać potraktowany jak event sourcing albo analityka —
  rozstrzygnięcie: jest lekkim audytem udanych komend; źródłem prawdy pozostają
  aktualne tabele, a logi błędów i kliknięcia mają osobne mechanizmy.
- Approval AI mogło być mylone z udanym zapisem — rozstrzygnięcie: **AI
  Proposal** opisuje zatwierdzaną intencję, a osobna **AI Execution** rewaliduje
  i zapisuje faktyczny wynik wykonania.
- AI mogło stale analizować cały Workspace — rozstrzygnięcie: działa na żądanie,
  z jawnym manifestem kontekstu; jedyną automatyzacją MVP jest opcjonalna
  klasyfikacja Inbox Itemu.
- „Plan” oznaczał zarówno projekt, listę dzienną, jak i zobowiązanie —
  rozstrzygnięcie: nie ma generycznego Planu w MVP; **Commitment** dopuszcza
  ukształtowany rezultat do aktywnego WIP, a Today i Week są jego projekcjami.
- „Appetite” było nieczytelnym terminem Shape Up — rozstrzygnięcie: opcjonalny
  **Effort Budget** ogranicza inwestowaną pracę i uruchamia ponowną ocenę, ale
  nie jest estymacją ani deadline'em.
- Limit WIP nie miał konkretnej jednostki — rozstrzygnięcie: liczymy aktywne
  **Commitments**, domyślnie najwyżej trzy, z których dokładnie jeden jest
  **Primary Commitment**.
- `needs_review` konkurowało ze stanami aktywności — rozstrzygnięcie:
  **Commitment** ma cztery stany (`active`, `paused`, `released`, `fulfilled`), a
  potrzeba przeglądu jest niezależną, wyliczaną flagą.
- Project miałby powielać stany `active` i `paused` — rozstrzygnięcie: jego cykl
  to `draft`, `shaped`, `validating`, `completed` albo `abandoned`, natomiast
  aktywność opisuje wyłącznie **Commitment**.
- Investigation nie potrzebuje cyklu Projectu — rozstrzygnięcie: jego cykl to
  `draft`, `shaped`, `concluded` albo `abandoned`, a Conclusion wystarcza do
  zakończenia bez obowiązkowej Decision.
- Learning Goal nie kończy trwałego Skill — rozstrzygnięcie: jego cykl to
  `draft`, `shaped`, `achieved` albo `abandoned`; późniejszy spadek retencji
  tworzy nowy cel zamiast zmieniać historyczne osiągnięcie.
- Dowolny ślad aktywności mógł być traktowany jako Evidence — rozstrzygnięcie:
  **Learning Evidence** jest niezmienną, ocenioną próbą; czas, kurs i sam
  **Artifact** nie wystarczają bez oceny względem kryterium.
- Inbox Item mógł zmieniać typ podczas triage — rozstrzygnięcie: pozostaje
  zachowanym źródłem capture, tworzy lub łączy obiekty docelowe i otrzymuje stan
  `resolved` zamiast zmieniać własny typ.
- Status, Archive i Delete mogły oznaczać usunięcie — rozstrzygnięcie: status
  opisuje wynik, **Archive** tylko widoczność, a **Trash** daje 30 dni na
  odzyskanie przed hard delete.
- „Project” był używany również dla stałych odpowiedzialności — rozstrzygnięcie:
  **Project** kończy się po dostarczeniu rezultatu, natomiast **Area** trwa bez
  stanu ukończenia.
- `Outcome` występował jako niezależny obiekt obok Projectu — rozstrzygnięcie:
  jeden aktualny **Outcome** jest obowiązkową częścią **Projectu**, a niezależne
  rezultaty wymagają osobnych Projects.
- `Requirement` miał pełny cykl podobny do Projectu — rozstrzygnięcie:
  **Requirement** jest elementem dokładnie jednego **Projectu**, a pracę nad nim
  reprezentują powiązane **Work Items**.
