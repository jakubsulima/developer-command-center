# Raport implementacji mobilnego UI i UX

Data: 30 września 2026. Status: wdrożenie lokalne zakończone; odbiór na urządzeniach pozostaje otwarty.

## Zakres

Wprowadzono wspólny fundament interfejsu z zachowaniem granatowego motywu, Geist i Lucide. Dodano tokeny odstępów i ruchu, zwiększono rozmiary tekstu pomocniczego i cele dotykowe, ograniczono dekoracyjne powierzchnie oraz dodano globalną obsługę `prefers-reduced-motion`. Nie dodawano zależności.

Start pokazuje „Na dziś” jako główną listę, a pilna decyzja nadal pozostaje widoczna, gdy wymaga jej rzeczywisty stan Działania. Z listy Startu, listy Działań i następnego kroku Celu można ukończyć proste Działanie jednym dotknięciem. Wspólna komenda czeka na potwierdzenie zapisu, udostępnia „Cofnij”, przywraca poprzedni status i zachowuje dodatkową akcję „Dodaj rezultat”. Błędy mutacji nadal pokazują retry.

Na liście Działań są krótkie widoki „Otwarte”, „Na dziś” i „Zaległe”; dodatkowe filtry, daty, kontekst URL i istniejące zachowanie listy pozostają dostępne. Formularz „Dodaj” rozpoczyna się od wymaganego tytułu. Opis jest opcjonalnie zwinięty, a kontekst miejsca i termin są widoczne jako podsumowanie z możliwością zmiany.

Shell i wspólne ekrany zyskały czytelny przycisk powrotu w szczegółach, uporządkowane menu „Więcej”, aktywny stan Ustawień, szkielet ładowania w obrębie shell oraz spójny ruch paneli. Wzorce mobilne rozszerzono na Projekty, Cele, Bibliotekę i szczegół Wiedzy, Skrzynkę, Rutyny, Podsumowanie/Plan/AI/Historię, wyszukiwanie, logowanie i Ustawienia. Drugorzędne akcje Skrzynki mają widoczne etykiety. Pola formularzy zachowują wielkość 16 px na mobile, a stopka QuickAdd uwzględnia safe area.

Istniejące zmiany Podsumowania, Planu, AI, szkiców, repozytoriów i CSS zostały zachowane. W Podsumowaniu usunięto wyłącznie nieużywaną lokalną zmienną, która blokowała lint; jego działanie się nie zmieniło. Testy tworzenia Projektu i książki uzupełniono o oczekiwanie na właściwy nagłówek po szkielecie ładowania, aby nie klikały globalnego przycisku Dodaj, zanim załaduje się strona docelowa.

## Porównanie przed i po

| Przepływ | Przed | Po |
| --- | --- | --- |
| Start → Działanie | Karta decyzji zajmowała dużo miejsca, a stan Działania zmieniało się przez menu; tytuły potrafiły wejść w obszar kontrolki na 320 px. | Lista „Na dziś” ma wyraźny rytm wierszy i oddzielną kontrolkę ukończenia. Przy 320 px poprawiono kolizję z tytułem i zawijanie terminu. Rzeczywiste zaległości nadal wymagają jawnej decyzji. |
| Lista Działań | Długi pasek statusów wymagał odkrycia przewijania, a ukończenie nie było osobną szybką akcją. | Trzy krótkie widoki codzienne, filtr za przyciskiem i oddzielne ukończenie z możliwością cofnięcia. |
| Dodaj | Formularz pokazywał więcej pól przed rozpoczęciem pisania. | Najpierw wymagany tytuł; opis i ustawienia rozwijane na żądanie. Podsumowanie miejsca i terminu zachowuje kontekst otwarcia. |
| Powrót i menu | W mobilnych szczegółach dominowały breadcrumbs, a Więcej łączyło moduły z profilem i narzędziami. | Szczegóły mają jawny powrót do kontekstu, a menu zaczyna się od modułów pracy. |
| Potwierdzenie operacji | Komunikat zakładał jedną akcję i rozsuwał przyciski, kiedy pojawiały się jednocześnie „Cofnij” i „Dodaj rezultat”. | Akcje są zgrupowane; na wąskim ekranie układają się pod komunikatem, ponad dolną nawigacją. Sukces pojawia się po rozstrzygnięciu zapisu. |
| Podsumowanie przy 320 px | Tekst przykładowy decyzji tygodnia był obcięty, a etykiety metryk miały bardzo mały rozmiar. | Pole ma większą wysokość, tekst przykładowy mieści się w całości, a etykiety są czytelniejsze. Zwinięty zapis pozostaje dostępny nad dolną nawigacją. |

Nie mierzono czasu wykonania tych zadań przed i po, dlatego raport nie deklaruje skrócenia czasu.

## Weryfikacja

Demo sprawdzono w przeglądarce Codex na szerokościach 320, 360, 390 i 430 px oraz na desktopie 1280 i 1440 px. Były to kontrole reprezentatywnych ekranów, a nie pełne zrzuty każdej trasy przy każdej szerokości.

| Szerokość | Sprawdzone przykłady |
| --- | --- |
| 320 px | Start, szczegół Celu, Działania, menu Więcej, Skrzynka, Biblioteka/szczegół Wiedzy, Rutyny, Ustawienia, Podsumowanie, Plan, AI, Historia i Dodaj. Sprawdzono zawijanie tytułów, dat i etykiet oraz dolną część dłuższych ekranów. |
| 360 px | Lista Działań z widokami szybkimi, statusem, terminami i dłuższymi tytułami. |
| 390 px | Start z „Najważniejsze teraz”, „Na dziś” i uzupełniającą sekcją AI. |
| 430 px | Start i pełnoekranowy QuickAdd otwarty ze Startu; podsumowanie Dodaj wskazywało „Na Starcie”. |
| 1280 px | Start i lista Działań w układzie desktopowym. |
| 1440 px | Start, widok szczegółu Działania oraz komunikaty operacji. |

W demo wykonano ukończenie Działania jednym dotknięciem, sprawdzono potwierdzenie i użyto „Cofnij”; poprzedni stan Działania wrócił. Nie pozostawiono testowej zmiany stanu. Po poprawce komunikat zawierający „Cofnij” i „Dodaj rezultat” jest czytelny także przy 320 px. Podczas oglądania Podsumowania przy 320 px zauważono obcięty tekst przykładowy pola decyzji — powiększono pole i potwierdzono cały tekst na ekranie.

Kontrole kodu i zachowania:

- `pnpm lint` — zakończone powodzeniem.
- `pnpm typecheck` — zakończone powodzeniem.
- `pnpm --filter @command/web test --reporter=dot --maxWorkers=2` — 70 plików, 490 testów, wszystkie zaliczone.
- `VITE_DATA_BACKEND=demo pnpm build` — zakończony powodzeniem; zbudowano klienta i wygenerowano pliki service workera PWA.
- `git diff --check` — bez błędów formatowania diffu.

## Ograniczenia

- Nie wykonano odbioru na fizycznym iPhonie ani Androidzie: Safari/Chrome, instalacja PWA, klawiatura ekranowa, gesty systemowe i realne safe area są niezweryfikowane.
- Nie przetestowano VoiceOver, TalkBack ani innego czytnika. Testy i zrzuty dostępności nie zastępują odbioru z technologią asystującą.
- Wersja demo jest zalogowana. Pełnego przepływu logowania nie można było obejrzeć w aktywnej sesji; sprawdzono tylko zmiany stylów w kodzie.
- Demo nie zawierało materiału z użytym wcześniej identyfikatorem książki, więc konkretnej trasy Czytelni nie udało się obejrzeć na działającym wpisie. Kod szczegółu Wiedzy sprawdzono, ale odbiór Czytelni na danych pozostaje otwarty.
- Build potwierdza wygenerowanie PWA, ale nie wykonano instalacji ani testu działania offline. Zapis produkcyjny nie był weryfikowany na koncie z backendem.
- CSS zawiera obsługę `prefers-reduced-motion`, ale nie emulowano ustawienia w przeglądarce. Nie wykonano formalnego pomiaru kontrastu, powiększenia do 200% ani profilowania animacji na słabszym urządzeniu.
- Ogląd wizualny obejmował reprezentatywne trasy i widoczne fragmenty ekranów. Nie wykonano automatycznego pomiaru geometrii każdego potomka kontenerów z `overflow: hidden`; odbiór wszystkich długich treści i pustych/błędowych stanów na urządzeniu jest nadal wskazany.
