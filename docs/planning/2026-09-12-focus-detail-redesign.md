# Plan wdrożenia: szczegóły Działania, Celu i Wiedzy — A / Focus

Status: wdrożony lokalnie i zweryfikowany po korekcie układu. Data: 12 września 2026.

**Decyzja użytkownika po wyborze projektu A:** zachowujemy obecną granatowo-niebieską paletę aplikacji. Z makiety odtwarzamy układ, hierarchię i płaskie sekcje. Ta decyzja zastępuje wszystkie pierwotne zalecenia grafitowo-miętowej kolorystyki poniżej. Wyniki sprawdzenia: [design-qa.md](../../design-qa.md).

## Polecenie dla modelu wykonującego

Zaimplementuj redesign trzech ekranów szczegółowych aplikacji Command zgodnie z tym planem i załączoną makietą **A / Focus**. Pracuj w istniejącej aplikacji React, nie twórz osobnego prototypu. Zachowaj funkcje, dane i kontrakty domenowe. Doprowadź zmiany do działającego i zweryfikowanego interfejsu na mobile oraz desktopie. Makieta określa kierunek wizualny, a ten dokument rozstrzyga zachowanie, responsywność i różnice względem danych. Nie kopiuj przykładowych treści ani liczników do produkcyjnego UI. Na koniec przedstaw zmienione pliki, wyniki sprawdzeń i zrzuty trzech ekranów. Zakres nie obejmuje publikacji, migracji bazy ani zmian modelu danych.

## Materiały i kontekst

- Referencja wizualna: [A / Focus](./assets/focus-detail-redesign-A.png). Trzy kolumny przedstawiają kolejno Działanie, Cel i Wiedzę.
- Repozytorium: `/Users/jakub/Documents/project-learning-app`.
- Trasy: `/actions/:actionId`, `/goals/:goalId`, `/knowledge/:knowledgeId` — przed zmianami sprawdź faktyczną nazwę parametru Wiedzy w routerze.
- Stos: React 19, TypeScript, Vite, React Router, TanStack Query, istniejące komponenty UI, Geist i lucide-react.
- Plan sporządzono po odczytaniu trzech stron, powiązań Działania, AppShell i stylów. Aktualny ekran Celu sprawdzono również w przeglądarce na mobile. Plan nie jest pełnym audytem wszystkich stanów.
- Przy rozpoczęciu przeczytaj obowiązujące AGENTS.md i aktualne instrukcje repozytorium. Sprawdź `git status` i aktualny diff. W momencie przygotowania planu istnieją niezapisane zmiany m.in. w AppShell, ContextNavigation, formularzach, styles.css i testach. Zachowaj je; nie resetuj ani nie nadpisuj pracy użytkownika.

## 1. Cel i granice redesignu

Ekrany mają pokazywać treść i następny sensowny krok, z mniejszą liczbą zagnieżdżonych kart. Wspólny język wizualny: grafit, miętowy akcent, czytelna typografia, cienkie separatory i proste wiersze powiązań.

W zakresie:

- Kompozycja, hierarchia, typografia, kolory i responsywność trzech szczegółów.
- Lepsza ekspozycja powiązań Działania, kryteriów Celu i treści Wiedzy.
- Zwijany formularz wpisu postępu i uporządkowanie dostępnych operacji.
- Dopasowanie wyglądu nagłówka i nawigacji aplikacji na tych trasach.
- Wszystkie obecne funkcje tych ekranów, również niewidoczne na obrazku.

Poza zakresem: redesign list i szczegółu Projektu, nowe AI, timer, metryki produktywności, edytor rich text, nowe pola Wiedzy, przebudowa zapisu lub autoryzacji. Nie wprowadzaj nowych zależności tylko dla wyglądu.

## 2. Specyfikacja wizualna

Wartości startowe do implementacji; dopracuj je na rzeczywistych zrzutach, zachowując charakter makiety.

| Element | Specyfikacja |
| --- | --- |
| Tło | grafit `#101416`, bez dominującego granatu |
| Powierzchnia wyróżniona | `#192320`, szczególnie następne Działanie |
| Tekst główny | `#F3F6F4` |
| Tekst pomocniczy | `#B0B9BA` |
| Akcent | mięta `#A9EBCD`; tekst na przycisku `#10221B` |
| Separatory | około `#303A3B`, cienkie 1 px |
| Font | istniejący Geist; bez nowej rodziny fontów |
| Tytuł mobile | 26–30 px, 600–650, line-height 1.15–1.25 |
| Treść | 15–16 px; Wiedza 16–18 px, line-height 1.65–1.75 |
| Metadane | 12–14 px, pomocnicze, ale nadal czytelne |
| Odstępy | rytm 4/8/12/16/24/32 px; boczne 16–24 px |
| Zaokrąglenia | 10–14 px dla wyróżnienia i przycisków |
| Ikony | lucide-react, spójnie około 18–20 px |
| Cele dotykowe | minimum 44 × 44 px dla interaktywnych kontrolek |

Nie odtwarzaj artefaktów generatora: dekoracyjnych poświat, faktur, pozornych cieni w tekście ani niedokładnych ikon. Nie kopiuj tła planszy, podpisów koncepcji, sloganów ani ramek telefonów do aplikacji.

Zwykła sekcja to nagłówek, treść i separator, nie kolejna karta w karcie. Jedynym silnym kolorystycznym wyróżnieniem Celu ma być następne Działanie. Mięta oznacza główne operacje i wybrane elementy; błędy i blokady zachowują własną semantykę oraz tekstowy opis.

## 3. Wspólna struktura i nawigacja

1. Zachowaj istniejący AppShell i jego wyszukiwanie, konto, status synchronizacji oraz obsługę dodawania.
2. Poniżej nagłówka pokaż istniejącą ścieżkę kontekstu i dostępny powrót. Nie wpisuj na sztywno `Projekty / Command` — ścieżka wynika ze źródła wejścia i relacji obiektu.
3. Tytuł obiektu umieść bez dużej zewnętrznej karty. Nie powtarzaj tego samego Projektu w kilku ciężkich panelach.
4. Zachowaj mobilne zakładki, menu „Więcej”, semantykę aktywnej trasy i kontekst środkowego plusa. Na Celu plus nadal dodaje Działanie do tego Celu.
5. Na wąskim telefonie wyszukiwanie może pozostać ikoną. Pole „Szukaj…” i avatar z grafiki nie uzasadniają dodawania nowej funkcjonalności ani ściskania nagłówka.
6. Zachowaj breadcrumbs, returnTo, returnLabel, identyfikatory kart, odtworzenie scrolla/fokusu oraz obsługę bezpośrednich linków.

Wprowadź jeden jawny wariant wizualny szczegółów, np. `appearance="focus-detail"` na AppShell i klasę obudowy. Obejmij nim tylko te trzy trasy. Nie ustalaj motywu przez kruchą analizę przypadkowych klas potomków. Zmienne CSS wariantu powinny objąć także menu/modal, jeśli renderują się przez portal — sprawdź ten przypadek i użyj istniejącego mechanizmu motywu lub jawnej klasy. Nie zmieniaj globalnie wyglądu pozostałych ekranów.

## 4. Działanie — układ i zachowanie

Docelowa kolejność na mobile:

1. Nawigacja kontekstowa.
2. Tytuł Działania.
3. Wiersz statusu i terminu z ikonami. Termin tylko jeśli istnieje.
4. Powiązany Cel lub Projekt jako klikalny wiersz. Działanie samodzielne nie otrzymuje fikcyjnego Celu.
5. Opis, bez zbędnego nadrzędnego tytułu „Szczegóły”.
6. Powiązana Wiedza w widocznych grupach: Materiały, Rezultaty, Decyzje i Pozostałe, zgodnie z faktycznym znaczeniem relacji.
7. Główny przycisk „Ukończ działanie”, pod nim „Przypnij do Startu” / „Odepnij od Startu”.

Grupy Materiałów i Rezultatów powinny być łatwe do znalezienia bez otwierania ogólnego panelu „Wiedza Działania”. W pustym stanie pokaż krótkie „Brak materiałów” i właściwą akcję; rezultat można dodać istniejącym ActionResultDialog. Nie ograniczaj obiektu do jednego rezultatu. Pozostałe grupy pokazuj, gdy mają elementy. Nie zacieraj różnicy między typem Wiedzy a rolą jej relacji.

Zachowaj podpinanie istniejącej Wiedzy, tworzenie nowej, dobór dozwolonej roli, odpinanie i walidację. Formularze mogą otwierać się na żądanie. Długie grupy można zwinąć przez „Pokaż wszystkie (N)” po kilku pozycjach, żeby główna operacja nie ginęła pod dziesiątkami linków. Przy powrocie do konkretnej karty automatycznie odsłoń ją.

Nie zmieniaj zasad ukończenia: zachowaj istniejące mutacje, loading, error/retry, undo i możliwość dodania rezultatu po ukończeniu. Dla ukończonego Działania nie pokazuj aktywnego przycisku ponownego ukończenia. Inne statusy i dostępność operacji odzwierciedlają aktualne reguły domenowe. Brak rodzica lub obiektu obsłuż istniejącymi stanami niedostępności.

## 5. Cel — układ i zachowanie

Docelowa kolejność na mobile:

1. Nawigacja i dyskretne menu „Opcje Celu”.
2. Tytuł, link do Projektu jeśli istnieje, oczekiwany rezultat.
3. Wyróżniony panel „Następne Działanie”: nazwa, dostępny termin/status i główna akcja otwarcia właściwego Działania.
4. Kryteria sukcesu widoczne od razu: licznik ukończonych / wszystkich i lista checkboxów.
5. Kompaktowe rozwijane wiersze „Działania”, „Historia postępu”, „Powiązana Wiedza”, z właściwymi licznikami.
6. „Dodaj wpis postępu” — początkowo zwinięty formularz.
7. Historyczne sekcje dodatkowe, gdy istnieją dane.

Usuń rozbudowane wstępy „Skup się na jednym kroku”, „Na później” oraz kartę wprowadzającą „Szczegóły Celu”. Nie usuwaj informacji, jeśli ma znaczenie operacyjne.

Brak następnego Działania: mały pusty stan z „Wybierz następne działanie”, otwierającym listę, albo „Dodaj działanie”, jeśli nie ma otwartych kroków. Nie wybieraj następnego kroku automatycznie. Zachowaj możliwość zmiany wskazania oraz dostępne obecnie sterowanie statusem Działań; samo zastąpienie przycisków linkiem nie może usuwać tych operacji.

Kryteria: pokaż pierwsze maksymalnie 3, resztę przez „Pokaż wszystkie (N)”. Checkboxy korzystają z obecnego updateGoal i obsługi błędów. Nie pokazuj procentu jako ogólnego postępu Celu. Jeśli zachowasz pasek, opisz go jako postęp kryteriów. Przy braku kryteriów użyj krótkiego komunikatu i wejścia do edycji, bez mylącego 0%.

Formularz postępu: rozwijany inline, zachowuje istniejące rodzaje wpisów, walidację, persistent draft, zapis i błąd. Rozwinięcie przenosi fokus do formularza. Jeśli istnieje odtworzony niezapisany szkic, pokaż go lub wyraźną akcję „Kontynuuj szkic”; zwinięcie nie kasuje treści. Sukces czyści szkic zgodnie z aktualnym kontraktem.

Zachowaj edycję Celu i kryteriów, zmianę statusu z uzasadnieniem, widoczność/archiwum/kosz, konflikty wersji, listę i historię Działań, checklisty, obsługę blokady, kolejność, wyniki, linkowanie Wiedzy i historyczne sesje. Licznik historii nie może udawać pełnej liczby wpisów, jeśli znana jest tylko pobrana strona; użyj wiarygodnej liczby albo jawnego „załadowano N”. Zachowaj ładowanie starszych wpisów i błędy paginacji.

Bezpośredni link z parametrem `?action=...` nadal odsłania właściwą sekcję, przewija do Działania i ustawia fokus.

## 6. Wiedza — układ i zachowanie

Docelowa kolejność na mobile:

1. Nawigacja kontekstowa.
2. Typ Wiedzy i „Edytuj” w spokojnym wierszu.
3. Tytuł i rzeczywista data aktualizacji zgodnie z dostępnymi danymi.
4. Główna treść na tle strony, bez sztucznego minimum wysokości i dużej karty.
5. Link źródłowy, jeśli istnieje i jest poprawny.
6. Projekty i powiązania z Celami, Działaniami, seriami oraz inną Wiedzą jako czytelne wiersze.
7. Potwierdzenia decyzji oraz pochodzenie ze Skrzynki, jeśli dotyczą obiektu.

**Ważna interpretacja obrazka:** „Najważniejszy wniosek” i „Jak to działa” to przykładowa treść, nie nowe pola. Aktualna treść Wiedzy jest tekstem. Zachowaj ją w całości, wraz z podziałem wierszy. Nie generuj podsumowań, nie dodawaj sztucznych nagłówków, nie zmieniaj zapisanej treści i nie wprowadzaj parsera Markdown tylko dla makiety. Miętową linię można zastosować jako subtelny akcent istniejącego bloku, bez narzucania treści użytkownikowi.

Zachowaj wszystkie rodzaje Wiedzy, zasady historycznych typów i rezultatu Działania. Edycja nadal obejmuje właściwe pola, link do źródła, Cele i walidację; zachowaj atomowy zapis relacji z Celami razem z edycją, szkice, konflikt wersji i możliwość skopiowania treści.

„Połącz wiedzę” na makiecie oznacza wejście do istniejących mechanizmów relacji. Zachowaj rozróżnienie operacji: łączenie Projektu, zmiana Celów w edycji, potwierdzenia Decyzji i pozostałe dostępne powiązania. Nie buduj nowej dowolnej relacji ani nie obiecuj jej przyciskiem. Relacje pośrednie z Projektami powinny nadal ujawniać źródło; ich usunięcie nie może działać jak odpięcie relacji bezpośredniej.

Zachowaj przywracanie z archiwum/kosza, undo, komunikaty błędów, bezpieczne linki źródłowe i niedostępne obiekty powiązane. Przy długiej notatce czytanie ma pierwszeństwo, a powiązania pozostają niżej lub w bocznej kolumnie desktopowej.

## 7. Responsywność i dostępność

- Mobile poniżej 768 px: jedna kolumna, bez przewijania poziomego. Treść przewija się naturalnie; nie próbuj zmieścić dowolnie długiego obiektu w jednym widoku makiety.
- Zachowaj dolną nawigację i safe-area. Dodaj właściwy dolny padding; żaden przycisk, formularz, toast ani ostatni link nie może zostać zasłonięty.
- 768–1023 px: jedna szersza kolumna lub istniejący shell tabletowy, bez wymuszania ciasnego układu bocznego.
- Od 1024 px: istniejąca nawigacja desktopowa; treść do około 1120 px. Działanie: główna kolumna i powiązania obok. Cel: tytuł nad układem, następne Działanie i lista po lewej, kryteria i dodatkowy kontekst po prawej. Wiedza: czytelna kolumna tekstu około 65–75 znaków i boczne relacje. Utrzymaj sensowną kolejność DOM oraz klawiatury; ogranicz wizualne przestawianie treści.
- Testuj szerokości 360, 390, 768 i 1440 px oraz powiększenie 200%.
- Długie tytuły i adresy zawijają się. Nie obcinaj kluczowego tytułu ani opisu do jednej linii.
- Jeden h1 na stronę, logiczne nagłówki sekcji, przyciski z nazwami, widoczny focus, natywna semantyka rozwijania, komunikaty błędów dostępne czytnikom.
- Zweryfikuj kontrast tekstu co najmniej 4.5:1 i istotnych kontrolek/fokusu 3:1; statusy nie polegają tylko na kolorze. Uwzględnij reduced-motion.
- Otwarty formularz, klawiatura ekranowa i portal modala zachowują czytelność, scroll oraz poprawny fokus.

## 8. Mapa kodu

Ścieżki względem katalogu repozytorium:

| Plik | Praca |
| --- | --- |
| `apps/web/src/pages/ActionDetailPage.tsx` | kompozycja Działania, metadane, rodzic, opis, CTA |
| `apps/web/src/pages/GoalDetailPage.tsx` | następny krok, widoczne kryteria, zwarte sekcje, zwijany wpis postępu |
| `apps/web/src/pages/KnowledgeDetailPage.tsx` | nagłówek, treść i relacje, zachowanie edycji |
| `apps/web/src/components/ActionKnowledgeRelations.tsx` | wariant szczegółowy z widocznymi grupami |
| `apps/web/src/components/AppShell.tsx` | jawny wariant wyglądu tych tras, nagłówek i dolna nawigacja |
| `apps/web/src/components/ContextNavigation.tsx` | zachować kontrakt; jedynie niezbędne dopasowanie wyglądu |
| `apps/web/src/styles.css` | ograniczone zakresem tokeny, układy i responsive; porządkowanie zmienianych reguł |
| `apps/web/src/components/ActionResultDialog.tsx` | wykorzystać istniejący przepływ rezultatu |
| `apps/web/src/components/ActionPrimaryControls.tsx` | zachować istniejące sterowanie Działaniami Celu |

ActionKnowledgeRelations jest używany także poza samodzielnym szczegółem. Dodaj opcjonalny wariant prezentacji z zachowaniem dotychczasowego domyślnego wyglądu, zamiast zmieniać wszystkie miejsca naraz. Wspólne komponenty nagłówka/wiersza sekcji wydziel tylko tam, gdzie faktycznie powtarza się zachowanie lub struktura. Nie twórz rozbudowanego uniwersalnego silnika szczegółów.

styles.css ma istniejące i nakładające się reguły szczegółów. Edytuj odpowiednie bloki i usuń wyłącznie zastąpione reguły z tego zakresu; nie dopisuj kolejnych globalnych override'ów ani masowo nie formatuj pliku.

## 9. Kolejność realizacji

1. **Stan bazowy:** odczyt instrukcji i diffu; uruchomienie aplikacji; zrzuty trzech obecnych ekranów i przegląd ich operacji. Ustal istniejące fixture/demo z relacjami. Zanotuj błędy bazowe przed przypisywaniem ich redesignowi.
2. **Wspólny styl:** wariant Focus, tokeny, obudowa, nagłówek i nawigacja. Sprawdź szerokości mobile i brak zmian innych tras.
3. **Pełny ekran Działania:** nowy układ, wariant relacji, wynik, przypięcie, błędy i cofanie. Zweryfikuj pionowy przepływ Działanie → Wiedza → powrót.
4. **Pełny ekran Celu:** wyróżnienie następnego kroku, kryteria, sekcje i wpis postępu. Zachowaj wszystkie obecne operacje i deep linki.
5. **Pełny ekran Wiedzy:** typografia, treść, relacje i edycja z istniejącym zapisem oraz szkicami.
6. **Dopracowanie responsive:** desktop, długie treści, puste stany, modale i klawiatura. Porównanie wszystkich trzech ekranów obok makiety A.
7. **Odbiór:** testy, sprawdzenie regresji, zrzuty końcowe i raport. Nie uznawaj samych przechodzących testów za dowód zgodności wizualnej.

## 10. Testy i scenariusze odbioru

Wykorzystaj i dostosuj istniejące testy, szczególnie `GoalExperience.test.tsx`, `ActionsPage.test.tsx`, `NavigationExperience.test.tsx`, `App.test.tsx`, `App.regression.test.tsx` oraz testy ActionPrimaryControls/ActionFeedback. Dodaj celowane testy zachowania, gdy obecne nie pokrywają zmiany; nie zastępuj ich snapshotami stylów.

Minimalna macierz:

- Działanie: status otwarty i ukończony, brak terminu/opisu, rodzic Cel/Projekt/brak/niedostępny, wiele rodzajów relacji, ukończenie, undo, rezultat, przypięcie, błąd i retry.
- Cel: brak Działań, brak wskazanego następnego, wskazany krok, brak/wiele kryteriów, przełączenie kryterium i błąd zapisu, rozwijanie sekcji, wpis postępu i odtworzony szkic, starsza historia, edycja/status/archiwum, `?action=...`.
- Wiedza: krótka/długa/pusta treść, źródło, notatka/materiał/decyzja/rezultat i typ historyczny, wiele Projektów, pośrednie powiązania, potwierdzenia Decyzji, edycja i konflikt szkicu, przywracanie.
- Nawigacja: Projekt → Cel → Działanie → Wiedza → powrót; właściwy kontekst, scroll, fokus i aktywne sekcje. Środkowy plus na Celu przekazuje właściwy cel do formularza.
- Wizualnie: trzy ekrany przy 390 px i 1440 px, dodatkowo 360/768 px, długie polskie tytuły, błędy, modal i otwarty formularz. Kontrola kontrastu, klawiatury i dolnej nawigacji.

Uruchom z katalogu repozytorium:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Sprawdź pełne przepływy w trybie demo. Dla połączonego środowiska sprawdź zgodność odczytu i kontraktu; mutacje weryfikuj tylko na testowych danych w odpowiednim środowisku. Nie używaj realnych obiektów użytkownika jako testów ukończenia/usuwania. Jeśli środowisko nie jest dostępne, zapisz konkretną lukę w weryfikacji, zamiast deklarować sprawdzenie.

## 11. Definition of Done i przekazanie

- Wszystkie trzy rzeczywiste ekrany mają spójny charakter A / Focus: grafit, mięta, płaska struktura, czytelne separatory.
- Działanie ujawnia kontekst, materiały/rezultaty i główną operację; Cel eksponuje następny krok i kryteria; Wiedza eksponuje treść.
- Brak stałych danych z makiety, nowych pól wymagających migracji i utraconych operacji.
- Nie zmieniono globalnie pozostałych ekranów ani istniejącego mechanizmu zapisu, draftów, błędów i nawigacji.
- Wszystkie kontrole są osiągalne na telefonie i klawiaturą, bez poziomego overflow i nakładania dolnego paska.
- Testy/checki zakończone; zastane błędy i ograniczenia wyraźnie oddzielone od nowych regresji.
- Zapisz zrzuty w osobnym katalogu, np. `docs/design/focus-detail-redesign/after/`, oraz krótki raport wdrożenia: co zmieniono, co sprawdzono i co ewentualnie pozostało.
- Dostarcz 6 zrzutów minimum: każdy ekran mobile i desktop. W raporcie wskaż istotne odstępstwa od obrazka wynikające z rzeczywistych danych lub dostępności.

W razie konfliktu: zachowanie danych i operacji oraz dostępność mają pierwszeństwo przed dosłownym kopiowaniem obrazka; w kwestiach hierarchii i wyglądu kieruj się tym planem oraz wariantem A. Drobne decyzje implementacyjne rozstrzygaj samodzielnie w tych granicach.
