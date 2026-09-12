# Plan wdrożenia „Dodaj” — mobile

Status: gotowy do realizacji, implementacja nierozpoczęta.
Podstawa: [audyt z 11 września](./2026-09-11-dodaj-mobile-audit.md).
Priorytet użytkownika: wygoda i wygląd na telefonie we wszystkich kontekstach dodawania.

## Efekt docelowy

Jeden panel tworzenia z sześcioma formularzami. Przycisk „Dodaj” otwiera właściwy typ i kontekst bieżącego ekranu. Nazwy, powiązania, terminy i podsumowanie odpowiadają zapisanym danym. Szkic przetrwa zamknięcie i zmianę typu, a klawiatura nie odcina dostępu do pola ani zapisu.

Wdrożenie w sześciu kolejnych etapach. Każdy etap kończy się działającym przepływem i sprawdzeniem wskazanych regresji. Nie przebudowujemy całej nawigacji ani modelu Projektów/Celów. Nie planujemy migracji bazy; używamy istniejących komend zapisu.

## Ustalone zasady interfejsu

- Mobile: panel od dolnej krawędzi, jedna powierzchnia, zaokrąglone górne rogi. Nagłówek i stopka nie przewijają się razem z treścią. Jedno przewijanie wewnętrzne, bez przewijania tła.
- Maksymalna wysokość i położenie wynikają z visualViewport. Safe area liczona raz. Na małej wysokości ograniczamy dekoracje i odstępy, zachowując dostępność pól oraz błędów.
- Pola mają widoczne etykiety, tekst co najmniej 16 px; cele dotykowe co najmniej 44 × 44 px. Podstawowe odstępy: 12–16 px.
- Nazwa i opis są osobnymi polami. Skrzynka zachowuje jedno wielolinijkowe pole. Decyzja ma jawne wymagane uzasadnienie.
- Wiersz „Typ · Zmień” rozwija siatkę 3 × 2 i zwija ją po wyborze. Zmiana nie uruchamia automatycznie klawiatury ekranowej.
- Powiązanie i termin mają krótkie wiersze z możliwością edycji. Dodatkowe ustawienia są zwinięte. Podstawowy harmonogram Rutyny pozostaje widoczny.
- Stopka: konkretny przycisk pełnej szerokości oraz krótki status szkicu. Pusty formularz nie pokazuje pustego wiersza statusu. Błąd zapisu szkicu zawsze pozostaje widoczny.
- Usuwamy intro „Jedno miejsce do tworzenia”, powtarzający wybór „Działanie cykliczne” i dekoracyjne ramki. Komendy tekstowe pozostają obsługiwane; pomoc jest opcjonalna na desktopie.
- Dolna nawigacja jest nieaktywna pod panelem i wizualnie przygaszona. Do zamykania służy przycisk w panelu. Desktop zachowuje wyśrodkowane okno.

## Etap 1 — zgodność formularza z zapisem

**Zakres:** `domain/quickAdd.ts`, `components/QuickAdd.tsx`, testy domeny i regresji aplikacji.

1. Wydzielić normalizację kontekstu na podstawie typu i aktualnych aktywnych obiektów. Ten sam wynik zasila pola, podsumowanie i dane komendy.
2. Działanie/Rutyna: Cel z jego Projektem albo sam Projekt. Wybór Celu wyznacza Projekt; nie utrzymujemy sprzecznej pary.
3. Cel: wyłącznie Projekt, także odziedziczony z Celu źródłowego. Projekt i Skrzynka nie zapisują relacji rodzica.
4. Biblioteka: jawne relacje do Projektu i wybranych Celów. Przy przejściu z Działania uwzględnić źródłowy Cel i usunąć duplikaty relacji.
5. Nieaktywny/niedostępny kontekst oznaczyć; zablokować zapis do czasu zmiany albo jawnego odłączenia. Zachować tekst. Ponowić sprawdzenie przed wysłaniem komendy.
6. Oddzielić walidację pól od błędów operacji. Nie przepuszczać błędów innych typów przez ogólny mapper Skrzynki. Dodać identyfikatory błędów dla `aria-describedby` i `aria-invalid`.
7. Dzisiaj/Jutro/Bez terminu oraz ręczna data zmieniają wyłącznie termin. Domyślne przypięcie pochodzi z miejsca wejścia.
8. W czasie zapisu zablokować wszystkie pola, listy wyboru, zmianę typu, odrzucenie szkicu i zamknięcie. Ponowny submit nie wysyła kolejnej operacji. Sprawdzić istniejący kontrakt ponowień komend; nie generować nowej operacji po niepewnym wyniku bez jego uzgodnienia.

**Odbiór:** testy Działanie → Cel/Biblioteka/Projekt; usunięty i zarchiwizowany kontekst; interwał 0/100/pusty, brak dni, brak uzasadnienia, niepoprawny URL; niezależność daty od przypięcia; podwójny submit i błąd zapisu. Sprawdzać dane zapisane, nie tylko podsumowanie UI.

## Etap 2 — szkice i zmiana typu bez utraty danych

**Zakres:** `hooks/usePersistentDraft.ts`, `QuickAdd.tsx`, `DraftStatus.tsx`, migracja danych formularza i testy hooka.

1. Przechowywać szkice per użytkownik, workspace, typ i kontekst encji; filtry listy nie tworzą kolejnych szkiców. Domyślne wartości wejścia stosować wyłącznie do nowego szkicu.
2. Zachować niezależne ustawienia poszczególnych typów: termin/przypięcie, harmonogram, rodzaj Biblioteki, URL, relacje.
3. Przy pustym typie docelowym przenieść nazwę/opis i znormalizowany kontekst. Przy istniejącym niepustym szkicu docelowym pokazać w panelu wybór „Wznów szkic” / „Użyj bieżącej treści”; zachować źródłowy szkic. Ten sam mechanizm dla komend tekstowych.
4. Migrować stare `global-quick-add` i `quick-add:*`: walidować każde pole, rozdzielić pierwszą linię na nazwę i resztę na opis; Skrzynka zachowuje oryginalną treść. Nie powielać jednego starego szkicu we wszystkich typach.
5. Stary zapis usunąć dopiero po poprawnym utrwaleniu nowej wersji. Uszkodzone pola nie mogą powodować awarii ani ukrywać odzyskiwalnej treści.
6. Wymusić zapis ostatniej zmiany przy zamknięciu/zmianie kontekstu; sprawdzić zmianę workspace i klucza. Sukces czyści tylko wysłany szkic.
7. Pokazać „Wznowiono szkic” z kontekstem oraz status zapisu na mobile. Błąd udostępnia ponowienie i kopiowanie całej treści; dodatkowe akcje szkicu są dostępne w menu.

**Odbiór:** zamknięcie przed 450 ms, odświeżenie, przejście między kontekstami/workspace, uszkodzony zapis i niedostępny storage; Materiał → Notatka → Materiał zachowuje URL; powrót do Działania zachowuje termin i przypięcie. Migracja jest powtarzalna i nie kasuje źródła przy błędzie.

## Etap 3 — wspólny panel mobilny i klawiatura

**Zakres:** `Modal.tsx`, `MultiCombobox.tsx`, `QuickAdd.tsx`, `styles.css`, `Modal.test.tsx`.

1. Uporządkować istniejące reguły CSS panelu zamiast dodawania kolejnej warstwy nadpisań. Wprowadzić jawny wariant panelu tworzenia, aby nie zmieniać przypadkiem wszystkich okien aplikacji.
2. Zbudować układ nagłówek / przewijana treść / stopka. Używać `min-height: 0` i wysokości visualViewport; przetestować powiększenie i przesunięcie viewportu.
3. Utrzymać etykiety nad polami; usunąć mobilne ukrywanie statusu szkicu. Wybór typu zwijać po wyborze. W razie błędu rozwijać właściwą sekcję i przewijać do pola.
4. Ujednolicić fokus w Modal i usunąć konkurencyjny autofocus QuickAdd. Dotyk: początkowy fokus panelu; klawiatura sprzętowa: właściwe pierwsze pole.
5. Poprawić kwalifikowanie summary zamkniętego details do kolejności fokusu, przywracanie fokusu i blokadę tła. Nazwa dostępna okna wynika z konkretnego nagłówka.
6. Escape zamyka najpierw rozwinięty wybór, potem panel. Lista powiązań mieści się w dostępnym obszarze i przewija aktywną opcję. Back telefonu najpierw zamyka panel z zachowaniem szkicu; obsługę historii połączyć z otwarciem/zamknięciem, bez pozostawiania pustych wpisów.

**Odbiór:** 320 × 568, 390 × 844, 430 × 932 oraz telefon w poziomie; długi opis, długie nazwy, otwarta lista, widoczny błąd; Tab/Shift+Tab i Escape. Szybka regresja wyszukiwania, edycji i potwierdzeń, ponieważ korzystają z Modal. Faktyczna klawiatura iOS/Android jest dodatkowym testem urządzenia, a zmniejszony viewport jej nie zastępuje.

## Etap 4 — wspólne formularze sześciu typów

**Zakres:** `QuickAdd.tsx`, `RecurringActionForm.tsx`, `KnowledgeKindPicker.tsx`, `CaptureComposer.tsx`, formularze w stronach Celów, Projektów i Wiedzy. Nowe moduły formularzy w `components/creation/`.

QuickAdd pozostaje koordynatorem typu i kontekstu. Wydzielone formularze odpowiadają za pola i walidację typu, a współdzielony cykl zapisu i szkicu obsługuje stan operacji. Nie tworzyć drugiego pełnego zestawu formularzy obok obecnego; przepinać istniejące wejścia po jednym typie.

| Kolejność | Formularz | Podstawowe pola i zachowanie |
| --- | --- | --- |
| 1 | Działanie | Nazwa, opcjonalny opis, powiązanie, termin, niezależne przypięcie. |
| 2 | Projekt | Nazwa, opcjonalny opis, bez nadrzędnego Projektu. |
| 3 | Cel | Nazwa, opcjonalny rezultat, Projekt; szablony, kryteria i pierwszy krok w dodatkowych opcjach. Własny tekst ma pierwszeństwo przed propozycją szablonu. |
| 4 | Skrzynka | Jedno pole, pełny oryginał, automatyczne rozpoznanie URL, bez pozornych relacji. |
| 5 | Biblioteka | Najpierw Notatka/Materiał/Decyzja; tytuł, odpowiednia treść lub uzasadnienie, opcjonalny link Materiału, relacje. |
| 6 | Rutyna | Nazwa, interwał, częstotliwość, dni, początek i 3 kolejne daty; koniec, checklista i polityka zaległości w dodatkowych opcjach. |

Zachować możliwości istniejących pełnych formularzy. Dla Rutyny zachować oddzielenie sukcesu utworzenia serii od błędu przygotowania wystąpień i ponawiać wyłącznie drugi krok. Podgląd i zapis używają tej samej strefy workspace; dni 29–31 pokazują faktyczną regułę krótszego miesiąca.

**Odbiór:** każdy typ zapisany z minimalnymi i rozszerzonymi danymi w środowisku testowym, z błędem walidacji i błędem operacji. Zmiana typu nie kasuje szkicu. Nieznana komenda pozostaje zwykłym tekstem. Wklejony tekst wielolinijkowy nie traci treści.

## Etap 5 — podłączenie każdego miejsca „Dodaj”

**Zakres:** `AppShell.tsx` i strony z audytu.

Jeden stan otwartego panelu i jedno żądanie zawierające typ, kontekst oraz wartości początkowe. Lokalne przyciski, puste widoki, dolny przycisk i skrót klawiaturowy korzystają z tej samej ścieżki. Aktywne wyszukiwanie/edycja nie mogą otworzyć konkurencyjnego panelu.

| Miejsce | Typ początkowy | Kontekst / wartości domyślne |
| --- | --- | --- |
| Start | Działanie | Przypięte, bez narzuconego terminu. |
| Działania | Działanie | Bez przypięcia; nie zmieniać filtrów po zapisie. |
| Szczegóły Celu | Działanie | Cel i jego Projekt. |
| Projekty | Projekt | Samodzielny Projekt. |
| Cele | Cel | Bez Projektu, chyba że istnieje jawny kontekst wejścia. |
| Projekt — Przegląd | Wybór typu | Bieżący Projekt zachowany dla obsługujących go typów. |
| Projekt — Działania | Działanie | Bieżący Projekt. |
| Projekt — Cele | Cel | Bieżący Projekt. |
| Projekt — Wiedza | Biblioteka | Relacja do bieżącego Projektu. |
| Rutyny | Rutyna | Nowa seria; edycja ma oddzielny szkic. |
| Wiedza — Biblioteka | Biblioteka | Jawne wybrane relacje. |
| Wiedza — Skrzynka | Skrzynka | Surowa treść bez powiązań. |
| Dodaj dowolne | Wybór typu | Bez kontekstu, o ile nie przekazano go jawnie. |

Sukces nazywa utworzony obiekt i daje „Otwórz”, jeśli istnieje odpowiedni widok. Przy aktywnym filtrze, który ukrywa wynik, wyjaśnić to bez samoczynnego resetowania filtra. Nowe obiekty tworzone z widoku archiwum są aktywne — zakomunikować miejsce zapisu.

**Odbiór:** każde wejście otwiera właściwy formularz; lokalna akcja i przycisk globalny mają zgodny rezultat. Po przepięciu usunąć stare formularze i nieużywane stany dopiero po potwierdzeniu równoważnych możliwości.

## Etap 6 — odbiór całości

- Automatyczne regresje zachowania: wszystkie 30 przejść między typami jako testy tabelaryczne normalizacji, a najważniejsze przejścia z niepustymi szkicami również przez UI.
- Zapisy sześciu typów w demo i izolowanym workspace testowym podłączonym do backendu; nie używać osobistych danych do prób.
- Stany: pusty, same spacje, poprawny, odzyskany szkic, trwa zapis, błąd pola, błąd sieci, niepewny wynik, ponowienie, sukces, wynik ukryty filtrem, brak storage.
- Telefon: Safari/iOS i Chrome/Android z realną klawiaturą, obrót, Back, przewijanie, wklejanie, wielolinijkowy tekst, selektor daty i lista powiązań. Dodatkowo powiększony tekst i klawiatura sprzętowa.
- Desktop: podstawowy zapis, skrót otwarcia i zapisu, fokus oraz zamykanie.
- Końcowe polecenia: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check:bundle`. Testy i build uruchamiać po zmianach implementacji; sam plan ich nie wymaga.
- Dowody odbioru: zrzuty mobilne sześciu formularzy, wyniki testów oraz lista urządzeń/przeglądarek. Nie oznaczać testów na prawdziwym telefonie jako wykonanych na podstawie emulacji.

## Warunek zakończenia

Każde wejście prowadzi do właściwego zapisu; podsumowanie odpowiada danym; tekst i ustawienia szkicu pozostają zachowane; błędy wskazują sposób poprawy; zapis i aktywne pole są dostępne przy otwartej klawiaturze. Wszystkie etapy i wyniki odbioru są rozliczone, a ewentualne ograniczenia sprzętowej weryfikacji jawnie zapisane.
