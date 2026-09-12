# „Dodaj” — audyt z priorytetem mobile

Data: 2026-09-11. Zakres: ocena i propozycje zmian, bez wdrażania zmian aplikacji.

## Co sprawdzono

- Aktualny interfejs localhost: wszystkie sześć typów w QuickAdd, wybór typu, pusty formularz, mobilny widok 320 × 568 i zastany wąski viewport; porównanie desktop 1440 × 900.
- Kod wejść: Start, Działania, Cele, Projekty, szczegóły Celu i Projektu, Rutyny, Biblioteka i Skrzynka; wspólny Modal, szkice, walidacja i zapisy QuickAdd.
- 51/51 istniejących testów w czterech plikach: quickAdd.test.ts, Modal.test.tsx, usePersistentDraft.test.tsx, App.regression.test.tsx.
- Nie wykonywano zapisów obiektów na aktualnym koncie. Nie sprawdzono prawdziwej klawiatury iOS/Android, błędów sieci ani pełnych zapisów każdą ścieżką. Wynik testów nie oznacza braku błędów.

## Ocena wizualna mobile

Przycisk zapisu jest osiągalny w sprawdzonym pustym formularzu przy 320 × 568. Zwijany wybór typu i siatka 3 × 2 są dobrą bazą. Główny problem to nadmiar zagnieżdżonych ramek oraz ukrywanie potrzebnych informacji w celu zmniejszenia panelu.

Proponowany układ:

1. Nagłówek „Nowe działanie” i zamknięcie z polem dotykowym co najmniej 44 × 44 px.
2. Jeden wiersz „Działanie · Zmień”; po wybraniu typu lista automatycznie się zwija.
3. Stała etykieta „Nazwa”, pole i opcjonalny osobny „Opis”. Dla Skrzynki jedno pole „Treść”. Obecnie etykieta wizualna na mobile znika, pozostaje placeholder i nazwa dostępna dla czytnika.
4. Kompaktowe, edytowalne wiersze „Projekt/Cel” oraz „Termin”, bez osobnej karty dla każdej informacji. Przypięcie do Startu opisane niezależnie.
5. „Więcej opcji” tylko dla pól dodatkowych. Harmonogram Rutyny i wymagane uzasadnienie Decyzji pozostają jawne.
6. Stopka zawsze w obrębie widocznego obszaru: dyskretny status szkicu, przycisk pełnej szerokości z konkretną nazwą operacji. Błąd szkicu musi być widoczny.

Jedna powierzchnia panelu, jeden kolor akcentu dla zaznaczenia i zapisu, mniej ikon dekoracyjnych, spójne odstępy 12–16 px i tekst pól co najmniej 16 px. Na małym ekranie panel od dolnej krawędzi, z zaokrągleniem u góry, zamiast małego okna otoczonego kilkoma obrysami. Przy otwarciu panelu dolna nawigacja nie powinna konkurować wizualnie z jego stopką.

## Najpierw poprawność

### P1 — podsumowanie kontekstu nie zawsze odpowiada zapisowi

QuickAdd wylicza effectiveAreaId z wybranego Celu, ale formularz Celu i Biblioteki pokazuje Projekt tylko na podstawie selectedAreaId. Po Działanie → Cel można zobaczyć „Bez Projektu”, mimo że zapis użyje Projektu odziedziczonego z Celu.

Po Działanie → Biblioteka podsumowanie może nadal pokazywać Cel, lecz zapis relacji Celów korzysta wyłącznie z goalIds i nie dołącza selectedGoalId. Nowy Projekt nie zapisuje rodzica, mimo że odziedziczone podsumowanie może go sugerować.

Poprawka: jedna funkcja wyznaczająca rzeczywisty kontekst dla typu, używana przez pola, podsumowanie i zapis. Przy zmianie typu jawnie przekształcać relacje. Nieaktualny Cel/Projekt ze szkicu oznaczyć i poprosić o poprawienie; obecnie ID może pozostać do wysłania mimo braku widocznej aktywnej opcji.

Źródło: apps/web/src/components/QuickAdd.tsx — selectedGoalId, effectiveAreaId, contextSummary, pola Projektu i submit.

### P1 — błędy nie wyjaśniają, co poprawić

QuickAdd zgłasza konkretne błędy interwału, braku dni tygodnia i uzasadnienia Decyzji, po czym przekazuje je do captureErrorMessage. Funkcja rozpoznaje tylko wybrane błędy Skrzynki, a resztę zamienia na „Nie udało się zapisać. Spróbuj ponownie.”

Poprawka: osobne, bezpieczne komunikaty walidacji dla pól. Rozwinąć odpowiednią sekcję i przewinąć do błędu. Błędy operacji sieciowych obsługiwać oddzielnie.

Źródło: QuickAdd.tsx submit/catch; apps/web/src/domain/capture.ts captureErrorMessage.

### P1 — mobile ukrywa cały stan szkicu

Reguła `.creation-hub-modal .quick-add-draft { display:none }` chowa status, błąd, ponowienie, kopiowanie i odrzucanie szkicu. Odzyskane ustawienia mogą obowiązywać bez widocznego wyjaśnienia. W oglądanym formularzu istniały wcześniejsze ustawienia Rutyny i Materiału.

Poprawka: krótki status w stopce; zawsze widoczny błąd z ponowieniem; dodatkowe akcje szkicu pod menu. Nie kasować istniejących szkiców podczas migracji.

Źródło: apps/web/src/styles.css:1450; QuickAdd.tsx quick-add-draft.

### P2 — termin zmienia również przypięcie

Przyciski Dzisiaj/Jutro/Bez terminu zmieniają pinnedToToday, podczas gdy ręczna zmiana daty go zachowuje. Interfejs mówi, że przypięcie jest osobnym ustawieniem.

Poprawka: wszystkie sposoby zmiany daty zmieniają tylko datę; przypięcie ma osobny przełącznik. Start może mieć domyślne przypięcie przy pierwszym otwarciu.

### P2 — formularze i blokada zapisu różnią się między wejściami

QuickAdd blokuje większość pól podczas zapisu, ale KnowledgeKindPicker i MultiCombobox nie dostają blokady. Pełne formularze nie wszędzie blokują zamknięcie i edycję: np. formularz nowego Celu w GoalsPage nie przekazuje closeDisabled. Zmiany wpisane podczas oczekiwania mogą zostać utracone przy sukcesie.

Poprawka: wspólny cykl tworzenia; zamrozić cały edytowany zestaw pól i zamknięcie podczas zapisu. Sukces usuwa tylko wysłany szkic. Błąd zachowuje dane.

### P2 — klawiatura i fokus wymagają domknięcia

Modal uwzględnia summary w selektorze fokusu, ale isFocusable wyklucza wszystkie elementy wewnątrz zamkniętego details, także samo summary. QuickAdd ma też własne automatyczne ustawianie fokusu oparte wyłącznie na szerokości 767 px, co może ominąć politykę dotykową Modal na tabletach i w poziomie.

Poprawka: dopuścić summary zamkniętej sekcji, stosować jedną politykę fokusu według sposobu interakcji. Sprawdzić Tab/Shift+Tab, Escape, powrót fokusu, obrót ekranu i widoczność aktywnego pola nad prawdziwą klawiaturą.

## Propozycje w każdym kontekście

| Wejście / typ | Propozycja na mobile |
| --- | --- |
| Start | Od razu Działanie, przypięte do Startu; jawne „Przypięte do Startu”, niezależnie od daty. |
| Lista Działań | Ten sam formularz, bez automatycznego przypięcia; czytelny termin i kontekst. |
| Szczegóły Celu | Od razu Działanie z nazwą Celu i jego Projektu; zmiana typu przekształca rzeczywiste relacje. |
| Projekt — Przegląd | Obecnie addAction jest undefined, więc globalne Dodaj nie dostaje projektu. Przekazać Projekt i umożliwić wybór typu bez utraty tego kontekstu. |
| Projekt — Działania/Cele/Wiedza | Typ wynikający z zakładki, zawsze widoczny Projekt. Współdzielić formularze z pozostałymi wejściami. |
| Lista Celów / Cel | Nazwa, rezultat opcjonalny, Projekt. Szablony, pierwszy krok i kryteria poniżej podstawowych pól. |
| Lista Projektów / Projekt | Nazwa i opcjonalny opis; bez pozornego Projektu nadrzędnego. Ten sam prosty formularz globalnie i lokalnie. |
| Rutyny / Rutyna | Jeden formularz z częstotliwością, dniami i trzema najbliższymi datami. Koniec, checklista i polityka zaległości w dodatkowych opcjach. QuickAdd obecnie nie pokazuje podglądu pełnego formularza. |
| Wiedza — Skrzynka | Jedno pole treści i automatyczne rozpoznanie URL, jasne „Zapisz do Skrzynki”. Ujednolicić lokalne wejście z panelem i zachować pełny tekst. |
| Wiedza — Biblioteka | Wybór Notatka/Materiał/Decyzja przed polami. Dla Materiału link; dla Decyzji jawne wymagane uzasadnienie. Powiązania spójne z podsumowaniem. |
| Globalne „Dodaj dowolne” | Wybór sześciu typów na początku, po wyborze kompaktowy formularz. |
| Archiwum, kosz, nieaktualny szkic | Nie dziedziczyć nieaktywnych ID po cichu. Wyjaśnić miejsce nowego wpisu i zachować tekst. |

## Kolejność wdrożenia i odbiór

1. Naprawić kontekst, komunikaty walidacji i widoczność problemów ze szkicem.
2. Ujednolicić formularze oraz niezależność terminu i przypięcia.
3. Uprościć mobilny układ i automatycznie zwijać wybór typu.
4. Przeprowadzić rzeczywiste testy iOS/Android z klawiaturą: 320/390/430 px, orientacja pozioma, długi tekst i długie nazwy powiązań.
5. Testować błąd sieci, powtórne kliknięcie, brak storage, szybkie zamknięcie, powrót do szkicu, zmianę typu, niedostępny kontekst oraz zapis ukryty przez filtr. Każdy typ sprawdzić poprzez zapis w izolowanym środowisku testowym.

Warunek odbioru: formularz pokazuje dokładnie to, co zapisze; potrzebne pola i błędy są czytelne; aktywne pole i zapis są osiągalne nad klawiaturą; zamknięcie, błąd i zmiana typu nie powodują utraty treści.
