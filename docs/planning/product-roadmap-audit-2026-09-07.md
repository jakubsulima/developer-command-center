# Plan rozwoju funkcjonalnego i wizualnego — 7 września 2026

Aplikacja ma już dobry fundament osobistego centrum pracy: Projekty, Cele, Działania, Rutyny, Wiedzę, wyszukiwanie i podsumowanie tygodnia. Największa wartość kolejnego etapu to łatwiejsze odnajdywanie pracy, bezpieczne zachowanie treści i czytelniejszy interfejs mobilny. Dodawanie kolejnych modułów powinno następować po dopracowaniu tych przepływów. Ten dokument zawiera 32 propozycje, ich zależności, ryzyka i warunki odbioru; jest planem, a nie deklaracją wykonania.

## Założenia i sposób oceny

- Główny odbiorca: jedna osoba prowadząca pracę i naukę w trwałych Projektach. Priorytet: codzienna użyteczność, mały koszt obsługi, łatwy powrót do kontekstu.
- Zakres: funkcje, UX, stylistyka oraz niezawodność potrzebna tym funkcjom. Bez implementacji, wdrożeń i zmian danych użytkownika.
- P1 = najważniejsze; P2 = średnia ważność; P3 = później, po potwierdzeniu potrzeby. Kolejność uwzględnia zależności, nie tylko numer.
- „Potwierdzone” oznacza wskazaną obserwację kodu, testu lub demo. „Częściowe” oznacza istniejący fundament bez pełnego przepływu. „Propozycja” oznacza nową możliwość, nie wykryty błąd.
- Nakład jest względny: mały = lokalny przepływ/UI, średni = kilka widoków i reguły domenowe, duży = nowy zapis, synchronizacja lub integracja. To nie są estymacje terminów.
- Ocena obejmuje bieżący katalog roboczy, również zastane zmiany w `styles.css`. Nie należy utożsamiać wyglądu demo z wdrożoną produkcją.

## Co już istnieje i czego nie planować od nowa

| Obszar | Stan stwierdzony podczas audytu | Pozostała niepewność |
| --- | --- | --- |
| Projekty → Cele → Działania | Trasy, formularze, kontekst nawigacji i testy przepływów istnieją; lista i szczegół Celu otwierają się w demo. | Nie wykonano pełnego przepływu na zdalnej bazie. |
| Start | W demo na 390×844 „Na dziś” jest widoczne bez przewijania; „Dalszy plan” jest zwinięty. | Nie sprawdzono wszystkich długości treści, dużych zbiorów i prawdziwego telefonu. |
| Szybkie dodawanie | Mobilne Dodaj otwiera pole z fokusem; Działanie jest wybrane. Są komendy `/cel`, `/działanie`, `/skrzynka` i trwały draft Quick Add. | Klawiatura ekranowa i przerwanie pracy wymagają osobnego testu urządzenia. |
| Szczegół Celu | Następne Działanie i szybki postęp są na górze; pozostałe sekcje są zwinięte. | Mobilny formularz postępu wymaga przewijania do przycisku zapisu. |
| Wiedza | Biblioteka i Skrzynka, typy treści, filtry, relacje, archiwizacja, kosz i undo są w kodzie i testach. | Nie zweryfikowano całej Biblioteki wizualnie ani jej pracy z dużym zbiorem. |
| Rutyny | Serie, reguły cyklu, checklisty i edycja są w kodzie; wybrane przepływy przeszły testy. | Powiadomienia i widok kalendarza nie wynikają z samego istnienia serii. |
| AI | Przegląd Celów oraz asystowany triage Skrzynki mają komponenty, logikę demo i kod funkcji backendowych. | Nie sprawdzono dostawcy, wdrożenia, jakości odpowiedzi ani kosztów. |
| Wyszukiwanie | Globalna wyszukiwarka, obsługa klawiatury, opóźnienie zapytania i limit 20 wyników istnieją. | Obsługa błędu zamienia wynik na pustą listę; brak wyniku nie jest odróżniany od awarii. |
| Zapis i przenośność | Są komendy, koordynator mutacji, informacja o synchronizacji, eksport JSON i lokalne repozytorium IndexedDB. | IndexedDB trybu lokalnego nie dowodzi istnienia outboxu offline dla zdalnego konta. Nie znaleziono pełnego importu przez UI. |
| Jakość | W tym audycie 4 pliki testów przepływów, 53 testy, zakończyły się powodzeniem. | To nie pełna suita, nie build i nie E2E produkcji. |

## Najważniejsze — P1

| ID / nakład | Zmiana i kategoria | Stan / dowód | Co trzeba dostarczyć i kryterium odbioru | Korzyść | Ryzyko / zależności |
| --- | --- | --- | --- | --- | --- |
| F01 / średni | **Jedna lista wszystkich Działań** — funkcjonalność | Brak trasy zbiorczej `/actions`; są Start, szczegóły i listy w kontekstach [S1]. | Widok z filtrami: dziś, zaległe, bez terminu, zablokowane, ukończone, Projekt i Cel. Filtry w URL, paginacja i powrót do miejsca na liście. Każde samodzielne Działanie bez daty można odnaleźć bez pamiętania tytułu. | Praca nie znika z pola widzenia po odpięciu ze Startu. | Nie dublować stanu Działania; nowy odczyt musi respektować widoczność rodziców. Dodatkowa pozycja nawigacji wymaga oszczędnego układu. |
| F02 / mały–średni | **Decyzje o zaległościach bez skakania między ekranami** — UX | Start pokazuje rekomendację; sugestie zaległości i blokad w tygodniu kierują na `/` [S2, S7]. | Z sugestii otworzyć dokładnie przefiltrowaną listę F01. Przy wierszu: ukończ, przełóż, anuluj, z undo i błędem. Akcja nie gubi listy ani fokusu. | Szybsze porządkowanie po przerwie. | Nie przekładać automatycznie całej kolejki. Zmiana jednego wystąpienia Rutyny nie może zmieniać serii. |
| F03 / mały | **Prawdziwe stany wyszukiwania** — niezawodność/UX | `GlobalSearch` w `catch` wykonuje `setResults([])`; pojedynczy znak również prowadzi do pustego wyniku [S3]. | Osobno: wpisz minimum 2 znaki, szukanie, brak wyników, błąd i ponów. Test wymuszonego błędu oraz opóźnionych odpowiedzi. Zachować wpisaną frazę. | Użytkownik nie uznaje awarii za utratę danych. | Nie wyświetlać surowych komunikatów backendu. |
| F04 / średni | **Spójne zachowanie niezapisanych treści** — niezawodność | Quick Add ma `usePersistentDraft`; formularz Startu, szybki postęp Celu i edycja Wiedzy używają lokalnego `useState` [S2, S4, S5]. | Przegląd formularzy i jeden kontrakt: trwały draft, przywróć/odrzuć, czytelny stan zapisu, ochrona wyjścia. Test: wpis → nawigacja/reload → odzyskanie; osobno zmiana konta i konflikt wersji. | Mniejszy koszt przerw i przypadkowego zamknięcia. | Prywatne drafty muszą być izolowane per konto/Workspace/rekord; lokalny draft nie może nadpisać nowszej wersji bez decyzji. |
| F05 / mały–średni | **Podsumowanie zgodne z aktualnym produktem** — funkcjonalność/język | UI nadal wyświetla „min fokusu”; reguła nadmiaru pracy korzysta z historycznych `projects.commitmentStatus` [S7]. Potwierdzono etykietę w demo. | Główne metryki oprzeć o Działania, postęp i osiągnięte Cele; historię Focus zachować w eksporcie. Przeliczyć sugestie przeciążenia według bieżącej domeny i uzgodnionej reguły, bez narzucania Projektom cyklu ukończenia. Test nowych oraz zmigrowanych danych. | Podsumowanie opisuje pracę, którą aplikacja rzeczywiście pozwala wykonywać. | Zmiana interpretacji historycznych raportów; zachować ich oryginalne dane i wyjaśnić nowe metryki. |
| F06 / średni | **Widoczna aktualność danych na dwóch urządzeniach** — niezawodność | Jest koordynator mutacji; globalnie `refetchOnWindowFocus: false` [S8]. Brak potwierdzonego testu dwóch urządzeń. | Najpierw odtworzyć zapis A → powrót do B, potem dobrać odświeżanie po powrocie/na żądanie lub zdarzeniowe. Stan „ostatnio odświeżono”, konflikt z zachowaniem własnego tekstu. Zmiana z A staje się widoczna w B bez wylogowania. | Większe zaufanie przy pracy komputer–telefon. | Dodatkowe zapytania i kolizje z draftami; zależy od F04. Nie nazywać lokalnej aktualizacji pełną synchronizacją. |
| F07 / średni–duży | **Przechwytywanie offline do Skrzynki** — funkcjonalność mobilna | PWA buforuje zasoby aplikacji, jest lokalne IndexedDB; plan outboxu istnieje, pełnej kolejki zdalnego capture nie znaleziono [S9]. | IndexedDB outbox per konto, identyfikator komendy, lokalnie/oczekuje/wysłano/błąd, retry po powrocie sieci i ręcznie. Test offline → zamknięcie → online daje dokładnie jeden wpis. | Myśl lub link nie przepada przy słabym zasięgu. | Wylogowanie, wyczerpanie pamięci, cofnięte uprawnienia. Najpierw wyłącznie nowy tekst/link; priorytet obniżyć do P2, jeśli mobile jest rzadko używany. |
| U01 / mały–średni | **Czytelny kontekst Działania na mobile** — UX/stylistyka | Mobilny Start ukrywa `.action-copy > small`; znika nazwa Celu [S2, S10], potwierdzone wizualnie. | Zostawić jedną krótką linię Projekt/Cel lub zwięzłą etykietę; dwa identycznie nazwane kroki dają się odróżnić bez otwierania. Sprawdzić 320/390/430 px i długie nazwy. | Mniej pomyłek przy ukończeniu Działania. | Większa wysokość wiersza; nie przywracać wszystkich metadanych naraz. |
| U02 / mały–średni | **Lżejszy szczegół Celu** — stylistyka/UX | Screenshot pokazuje panel w panelu, kilka tekstów instruktażowych i osobny wiersz „Wiedza · 0” [S4]. | Ograniczyć zagnieżdżone ramki, skrócić instrukcje, skompaktować pustą relację Wiedzy. Następny krok, kontekst i ukończenie zachowują pierwszeństwo; postęp i jego zapis są łatwo osiągalne z klawiaturą ekranową. | Więcej użytecznej treści na ekranie. | Nie ukryć sposobu dodania pierwszego materiału; ponownie przetestować fokus i zwinięte sekcje. |
| U03 / średni | **Czytelność i obsługa dotykiem** — stylistyka/dostępność | Są etykiety 10–12 px, małe badge i ucięte podsumowanie „Dalszy plan”; fokus ma już styl [S10]. | Pomiar kontrastu, powiększenie ważnych opisów, przegląd obszarów dotyku i 200% zoom. Zapewnić widoczne etykiety ikon oraz przekazanie stanu inaczej niż kolorem. Test klawiatury i czytnika dla głównych przepływów. | Mniej mrużenia oczu i nietrafionych kliknięć. | Nie stwierdzono pełnej niezgodności dostępności — wymaga pomiaru. Większy tekst trzeba sprawdzić razem z układem. |
| Q01 / średni | **Zamknąć weryfikację realnego konta** — gotowość produktu | Raport staging z 27 sierpnia ma status niewykonany i historyczną rozbieżność migracji [S11]. To nie dowód dzisiejszego stanu serwera. | Odczytać aktualny stan, wyjaśnić ewentualne rozbieżności, wykonać rejestracja/login → capture → Działanie → ukończenie → reload → drugie urządzenie → eksport. Zweryfikować monitoring i odtwarzanie. Zapisać aktualny raport. | Potwierdzenie, że aplikacja nadaje się do rzeczywistej pracy. | Wymaga środowiska i konta testowego; wdrożenie poza zakresem tego audytu. Zdalnej historii migracji nie naprawiać na podstawie samej daty raportu. |

## Średnia ważność — P2

| ID / nakład | Zmiana i kategoria | Stan / dowód | Co trzeba dostarczyć i kryterium odbioru | Korzyść | Ryzyko / zależności |
| --- | --- | --- | --- | --- | --- |
| F08 / średni | **Plan tygodnia jako agenda** — funkcjonalność | Start ma horyzont 7 dni; brak osobnej agendy w routerze [S1, S2]. | Dni tygodnia + lista bez daty, przypisanie/przełożenie Działania również bez drag-and-drop. Korzystać z istniejącej daty i strefy. Reload zachowuje plan. | Planowanie większego fragmentu pracy. | Nie dodawać od razu godzin i synchronizacji kalendarzy; zależy od F01. |
| F09 / średni | **Zapisane widoki i ulubione konteksty** — UX | Istnieją filtry w URL, brak widocznego zarządzania zapisanymi zestawami [S6]. | Zapisywanie nazwy i filtrów, edycja/usunięcie; pin Projektu/Celu do szybkiego dostępu. Nie kopiować rekordów. Nieaktywny cel filtra ma czytelny komunikat. | Szybki powrót np. do „Nauka bez terminu”. | Nadmiar zakładek; zacząć od kilku ulubionych, zależność F01. |
| F10 / średni | **Operacje zbiorcze na listach** — funkcjonalność | Główne kontrolki dotyczą pojedynczych rekordów [S2, S6]. | Wybór wielu Działań: data, kontekst, anulowanie; w Skrzynce odłóż/odrzuć. Podgląd zakresu, raport częściowych błędów i undo. | Szybszy porządek po dłuższej przerwie. | Przypadkowa zmiana wielu danych; nie mieszać edycji serii i wystąpień. Po F01/F02. |
| F11 / średni | **Powód blokady i termin powrotu** — funkcjonalność | Działanie ma `blocked` i tekst `blocker` [S12]. | Rozszerzyć o opcjonalne „wróć dnia”, wskazanie czego oczekuję, listę oczekujących i odblokowanie. Oddzielić datę powrotu od wykonania. | Sprawy zależne od innych nie zostają zapomniane. | Kolejna data może mylić; najpierw prosty widok w F01, bez rozbudowanego grafu zależności. |
| F12 / średni | **Podgląd kolejnych wystąpień Rutyny** — UX/funkcjonalność | Są reguły i polityki zaległości [S13]. | W formularzu pokazać najbliższe daty i skutki zmiany; jasno „to wystąpienie / przyszłe wystąpienia”. Test końca miesiąca, strefy, przerwy i wznowienia. | Użytkownik rozumie, co utworzy seria. | Wyjątki zwiększają złożoność; zacząć od podglądu istniejących reguł. |
| F13 / średni | **Wygodna praca z dłuższą Wiedzą** — funkcjonalność/stylistyka | Treść jest edytowana w textarea i wyświetlana jako tekst [S5]. | Lekki Markdown z podglądem: nagłówki, listy, kod, linki; kopiowanie fragmentów i link do notatki. Zachować zwykły tekst i stare wpisy. | Materiały techniczne i notatki są czytelniejsze. | Bezpieczny renderer, brak surowego HTML, koszt pakietu i dostępność edytora; po F04. |
| F14 / średni | **Duplikaty linków i istniejąca Wiedza przy capture** — funkcjonalność | Capture/triage istnieją [S6]; proponowane rozszerzenie. | Ostrożna normalizacja URL i podpowiedź istniejącego materiału; otwórz/dołącz relację/zapisz mimo to. Oryginał capture pozostaje zachowany. | Mniej powielonych materiałów i ponownego czytania. | Różne URL mogą oznaczać różne wersje; żadnego automatycznego scalania. |
| F15 / duży | **Import i odtworzenie eksportu** — przenośność | Jest eksport JSON w profilu, brak odpowiadającego przepływu importu [S14]. | Wersjonowany format, walidacja, próbny raport i import do pustej przestrzeni. Obsłużyć relacje/historyczne rekordy, idempotencję i błędy. Test eksport → import porównuje liczby i relacje. | Kopia jest użyteczna także do odzyskania pracy. | Duplikaty, obce identyfikatory, stare schematy; pierwszy wariant bez łączenia dwóch zajętych przestrzeni. |
| F16 / średni | **Podsumowanie prowadzące do konkretnych decyzji** — funkcjonalność | Istnieją metryki, sugestie, notatka i historia tygodni [S7]. | Rozszerzyć bieżący ekran o otwarcie właściwej listy, wybór następnego kroku i porównanie osiągniętych rezultatów. Zachować zapis migawki tygodnia. | Przegląd daje plan dalszej pracy, nie tylko licznik. | Nie wracać do obowiązkowej checklisty Review ani rankingów aktywności; po F02/F05. |
| F17 / średni | **Rozszerzona wyszukiwarka** — funkcjonalność | Globalnie maksymalnie 20 wyników, bez strony wszystkich wyników [S3]. | „Pokaż wszystkie”, typ, Projekt/Cel, archiwum na żądanie, paginacja i fragment trafienia. Test materiału poza pierwszą stroną. | Wiedza pozostaje odnajdywalna po rozrośnięciu zbioru. | Koszt zapytań i ujawnianie archiwum; po naprawie F03. |
| U04 / średni | **Motyw jasny / ciemny / systemowy** — stylistyka | CSS wymusza ciemny schemat i zawiera kolory wpisane bezpośrednio [S10]. | Ujednolicić tokeny, przygotować komplet powierzchni i stanów, zapisać preferencję bez migotania przy starcie. Wszystkie główne ekrany i formularze czytelne w obu motywach. | Komfort w jasnym otoczeniu i wybór użytkownika. | To więcej niż odwrócenie tła; ryzyko niespójnych stanów i zwiększenie zakresu testów. |
| U05 / średni | **Spójna hierarchia wizualna i gęstość** — stylistyka | Start, Cel i Podsumowanie mają liczne obramowania, etykiety i odmienne układy sekcji [S2, S4, S7, S10]. | Jeden wzorzec nagłówka, listy, sekcji i akcji głównej; tryb zwarty opcjonalnie dla list desktopowych. Zachować rozpoznawalną granatowo-niebieską paletę. | Szybsze skanowanie i spokojniejszy wygląd. | Nie spłaszczyć wszystkich poziomów do identycznych wierszy; zacząć od U02/U03. |
| U06 / mały–średni | **Prosty język, liczby i daty** — UX | W UI pozostaje „Workspace”, typ Celu „Projekt”, odmiany „1 działań”, „0 ukończone”; „Dalszy plan” ucina tekst [S2, S6, S7, S14]. | Uzgodnić nazwy, poprawić polskie liczebniki i etykiety dat; odróżnić Projekt-kontekst od typu Celu. Na telefonie skrócić podsumowanie tak, by liczba spraw wymagających uwagi była czytelna. | Mniej interpretowania znaczenia elementów. | Zmieniać etykiety, nie historyczne identyfikatory; nie wprowadzać nowych synonimów bez potrzeby. |
| Q02 / średni | **Regresja wyglądu i pracy na większych danych** — jakość | Są testy komponentów i raport wydajności; stary budżet bundle nie jest dzisiejszym pomiarem [S15]. | Powtarzalne scenariusze dla małej/dużej bazy demo, 390 px i desktopu; długie tytuły, brak danych, błąd, zoom, przejścia i Quick Add. Production build, pomiar czasu i bundle przed/po. | Dalsze funkcje nie psują szybkości ani mobile. | Koszt utrzymania screenshotów; nie testować wyłącznie pikseli ani traktować usuwania CSS jako celu produktu. |

## Później / warunkowo — P3

| ID / nakład | Propozycja | Obecny punkt wyjścia | Zakres pierwszej użytecznej wersji i odbiór | Korzyść | Ryzyko / warunek rozpoczęcia |
| --- | --- | --- | --- | --- | --- |
| F18 / duży | **Przypomnienia o wybranych sprawach** | Daty i Rutyny istnieją; nie znaleziono pełnego przepływu dostarczania powiadomień. | Jawna zgoda, kanał, strefa, cisza nocna, odroczenie i wyłączenie. Test dostarczenia oraz deduplikacji po zmianie terminu. | Pomoc przy terminach bez konieczności ciągłego otwierania aplikacji. | Zmęczenie alertami, zadania backendowe, koszt i ograniczenia platform. Dopiero po potwierdzeniu potrzeby. |
| F19 / średni–duży | **Dodawanie z menu Udostępnij** | Jest PWA, ale manifest nie definiuje `share_target` [S9]. | Tekst/link → podgląd → Skrzynka, z fallbackiem kopiuj/wklej i kolejką F07. Test na wybranej platformie. | Mniej kroków przy zbieraniu materiałów z telefonu. | Wsparcie zależy od platformy; przed implementacją sprawdzić aktualne możliwości docelowych przeglądarek. |
| F20 / duży | **Powtórki i praktyczne sprawdzanie nauki** | Cele typu nauka, kryteria i dowody postępu już istnieją [S4, S12]. | Opcjonalne pytania/próby do materiału, samoocena, termin kolejnej powtórki i zapis dowodu do Celu. Oddzielić wykonanie powtórki od osiągnięcia Celu. | Nauka prowadzi do sprawdzonej umiejętności. | Ryzyko zbudowania drugiej aplikacji. Awansować do P1/P2 tylko jeśli nauka jest głównym zastosowaniem. |
| F21 / duży | **Załączniki do Wiedzy i rezultatów** | Typ `file` w domenie nie dowodzi działającego uploadu [S12]. | Jeden plik → postęp przesyłania → prywatny dostęp → pobranie/usunięcie; limity typu/rozmiaru, sprzątanie przerwanych uploadów i eksport metadanych. | Dowód lub materiał znajduje się przy właściwym kontekście. | Koszty storage, prywatność, walidacja i wygasające linki. Po Q01 i ustaleniu potrzebnych typów plików. |
| F22 / duży | **AI dzielące Cel na propozycje Działań** | AI przegląda Cele i pomaga w triage [S16]. | Na żądanie mały plan z uzasadnieniem, edycją i niezależnym wyborem kroków; dopiero zatwierdzone pozycje przechodzą zwykłe komendy. Limity kosztów, walidacja kontekstu, test jakości po polsku i obsługa awarii. | Mniejsza trudność rozpoczęcia niejasnego Celu. | Nadprodukcja zadań, błędne założenia i koszty. Najpierw ocenić użyteczność już istniejącego AI. |
| F23 / średni | **Eksport planu do kalendarza** | Brak takiego przepływu w aktywnym UI. | Najpierw eksport wybranych pozycji do ICS z jawnie określoną semantyką dat; podgląd i stabilne identyfikatory. | Plan jest widoczny obok innych zobowiązań. | Daty całodniowe nie są blokami czasu. Dwukierunkową synchronizację odłożyć do czasu potwierdzenia popytu. |
| F24 / średni | **Szybsza obsługa klawiaturą i interpretacja dat** | Są skróty globalne i parser komend typu obiektu [S3, S14]. | Dostępna lista skrótów; opcjonalnie rozpoznanie „jutro” z widocznym podglądem daty i możliwością wyłączenia interpretacji. Test pola tekstowego i polskich fraz. | Szybsze zapisywanie przy intensywnej pracy desktopowej. | Konflikty skrótów i błędna interpretacja zwykłego tekstu; bez automatycznych zmian ukrytych przed użytkownikiem. |

## Kolejność wdrożenia

1. **Naprawić znaczenie i informację zwrotną:** F03, F05, U06. Równolegle organizacyjnie przygotować Q01; ten dokument nie upoważnia do wdrożeń. Są to małe, konkretne poprawki o wysokiej pewności.
2. **Zabezpieczyć kontynuowanie pracy:** F04, następnie F06. Zweryfikować konflikty przed dodaniem nowych źródeł zapisu.
3. **Uporządkować codzienną pracę:** F01 → F02 → F08/F09 → F10/F11. Po F02 i F05 rozwinąć podsumowanie F16.
4. **Dopracować mobile i wygląd:** U01 → U02/U03 → U05 → U04. Q02 stosować przy każdym większym etapie UI, nie zostawiać wyłącznie na koniec.
5. **Rozwinąć przechwytywanie i Wiedzę:** F07, jeśli mobile jest ważny; F12–F15 i F17 według realnych problemów. F19 dopiero po trwałym capture. Import F15 można przyspieszyć, jeśli aplikacja przechowuje jedyną kopię ważnych notatek.
6. **Wybrać jeden kierunek specjalizacji:** F20 (nauka), F18/F23 (terminy), F21 (materiały) lub F22 (planowanie z AI). Nie realizować wszystkich jednocześnie.

### Proponowany pierwszy pakiet

- [ ] F03 — wyszukiwanie: błąd, retry, minimalna fraza.
- [ ] F05 — usunięcie historycznej metryki z głównego podsumowania i poprawne reguły sugestii.
- [ ] U01 — kontekst Działania na mobilnym Starcie.
- [ ] U06 — polskie etykiety, odmiany i czytelne liczniki.
- [ ] F04 — najpierw ochrona szybkiego postępu Celu i dłuższej edycji Wiedzy.
- [ ] Q01 — aktualny raport realnego przepływu na środowisku testowym.

Po tym pakiecie rozpocząć F01/F02. Nie trzeba podejmować wszystkich decyzji o P3 przed pierwszym wdrożeniem.

## Wspólne kryteria odbioru przyszłych prac

- Funkcja działa od wejścia użytkownika do trwałego wyniku w demo i na testowym backendzie; sam komponent lub tabela nie wystarcza.
- Dla zmiany zapisu: idempotencja, izolacja Workspace, aktualna wersja rekordu, błąd/retry, migracja kompatybilna wstecz i możliwość odtworzenia. Dla samej korekty tekstu nie dodawać zbędnej infrastruktury.
- Sukces, brak danych, brak wyników, błąd i loading dają się odróżnić. Tekst użytkownika pozostaje przy błędzie.
- Sprawdzić klawiaturę, 390×844, desktop, długi tekst i — dla funkcji mobilnych — prawdziwą klawiaturę ekranową.
- Uruchomić testy adekwatne do zmiany oraz wymagane kontrole projektu. Aktualizować status dopiero z dowodem, nie na podstawie obecności pliku planu.
- Po wdrożeniu sprawdzić użyteczność na rzeczywistych zadaniach: czy łatwiej odnaleźć krok, zachować notatkę, przełożyć zaległość i wrócić do pracy. Nie optymalizować wyłącznie liczby kliknięć lub ukończonych Działań.

## Rozliczenie wcześniejszych planów

| Wcześniejszy plan | Ustalenie na 7 września | Dalsze postępowanie |
| --- | --- | --- |
| Plan 01 — Start i dodawanie | Główna hierarchia i mobilne pole z fokusem potwierdzone w demo i testach. | Nie implementować drugi raz; dopracowanie U01/U02. |
| Plan 02 — realni użytkownicy | Onboarding i adaptery istnieją; raport staging nadal opisuje niewykonany checkpoint. | Q01. Nie uznawać całego planu za zamknięty. |
| Plan 03 — AI triage | Kod i test przepływu istnieją. | Zweryfikować realne AI i jakość; nie budować ponownie MVP. |
| Plan 04 — offline | Nie znaleziono pełnego outboxu zdalnego capture. | F07 rozwija ten sam plan. |
| Plan 05 — szczegół Celu i język | Główna hierarchia potwierdzona; historyczny język nadal jest w podsumowaniu i etykietach. | U02, U06, F05. |
| Plan 06 — wydajność | Są lazy routes, metryki i raport wcześniejszych zmian. | Q02; stare wartości bundle nie stanowią pomiaru bieżącej wersji. |

Poprzednie dokumenty pozostają historią i szczegółowymi specyfikacjami. Przy rozpoczynaniu zadania należy porównać ich stan wyjściowy z bieżącym kodem. `CONTEXT.md` także zawiera część historyczną — obowiązuje aktualny model trwałego Projektu, nie stare zobowiązania i sesje Focus.

## Decyzje, które najbardziej zmienią ranking

1. **Nauka czy ogólna organizacja pracy?** Jeśli nauka jest głównym celem, F20 awansuje przed rozbudowaną agendę i operacje zbiorcze.
2. **Telefon czy komputer jako główne miejsce użycia?** Telefon podnosi F07/F19, komputer — F09/F17/F24. Poprawki czytelności pozostają potrzebne w obu wariantach.
3. **Narzędzie prywatne czy aplikacja dla kolejnych osób?** Drugi wariant wymaga zamknięcia Q01 i sprawdzenia pierwszego użycia przed rozbudową AI. Współdzielenie, role, płatności i marketplace pozostają poza tą roadmapą do czasu osobnej decyzji.

To decyzje do kolejnego etapu, nie blokada zapisania ani wykorzystania planu.

## Dowody i ograniczenia audytu

### Weryfikacja wykonana teraz

- Przegląd kodu aktywnych tras, domeny, formularzy, wyszukiwania, zapisu, CSS i wcześniejszych planów.
- Lokalny Vite uruchomiony z `VITE_DATA_BACKEND=demo`; ogląd Startu, listy Celów, szczegółu Celu, mobilnego Quick Add i Podsumowania. Desktop: domyślny viewport przeglądarki; mobile: emulowane 390×844.
- Start ładuje treść, nie pokazuje nakładki błędu; odczyt logów `error/warn` po jego otwarciu był pusty. Nie jest to deklaracja braku błędów w całym produkcie.
- Polecenie `pnpm --filter @command/web exec vitest run src/app/App.test.tsx src/app/App.regression.test.tsx src/app/GoalExperience.test.tsx src/app/NavigationExperience.test.tsx`: **4 pliki, 53 testy PASS**.
- Nie zmieniano kodu aplikacji ani zastanych zmian w `styles.css`, `package.json`, `pnpm-lock.yaml`.

### Niezweryfikowane

Nie wykonano pełnej suity, lint/typecheck/build, audytu bezpieczeństwa, aktualnego odczytu zdalnych migracji, testu logowania i synchronizacji na realnym backendzie, testu płatnego AI, pomiaru kontrastu, przeglądu wszystkich ekranów ani testu prawdziwego urządzenia/PWA offline. Propozycje stylistyczne są oceną ekspercką wspartą wybranymi ekranami, nie wynikiem badań użytkowników. Nie przypisywać im gwarantowanego wzrostu produktywności.

### Mapa źródeł w repozytorium

- **S1:** [routing](../../apps/web/src/app/App.tsx).
- **S2:** [Start](../../apps/web/src/pages/StartPage.tsx), [projekcja Startu](../../apps/web/src/domain/homeSummary.ts).
- **S3:** [wyszukiwanie](../../apps/web/src/components/GlobalSearch.tsx).
- **S4:** [szczegół Celu](../../apps/web/src/pages/GoalDetailPage.tsx), [testy Celu](../../apps/web/src/app/GoalExperience.test.tsx).
- **S5:** [edycja Wiedzy](../../apps/web/src/pages/KnowledgeDetailPage.tsx), [drafty](../../apps/web/src/hooks/usePersistentDraft.ts), [Quick Add](../../apps/web/src/components/QuickAdd.tsx).
- **S6:** [Cele](../../apps/web/src/pages/GoalsPage.tsx), [Wiedza](../../apps/web/src/pages/KnowledgePage.tsx), [Skrzynka](../../apps/web/src/pages/InboxPage.tsx).
- **S7:** [Podsumowanie](../../apps/web/src/pages/ReviewPage.tsx), [reguły tygodnia](../../apps/web/src/domain/weeklyReview.ts).
- **S8:** [konfiguracja zapytań](../../apps/web/src/main.tsx), [store](../../apps/web/src/app/store.tsx), [koordynator mutacji](../../apps/web/src/app/workspaceMutationCoordinator.ts).
- **S9:** [PWA](../../apps/web/vite.config.ts), [lokalne repozytorium](../../apps/web/src/data/localWorkspaceRepository.ts), [plan offline](./plan-04-offline-capture.md).
- **S10:** [aktualny arkusz stylów](../../apps/web/src/styles.css).
- **S11:** [historyczny raport staging](../testing/staging-e2e-2026-08-27.md).
- **S12:** [typy domenowe](../../apps/web/src/domain/types.ts), [aktualny język](../../CONTEXT.md).
- **S13:** [Rutyny](../../apps/web/src/pages/RoutinesPage.tsx), [formularz serii](../../apps/web/src/components/RecurringActionForm.tsx), [reguły cyklu](../../apps/web/src/domain/recurrence.ts).
- **S14:** [nawigacja, eksport i skróty](../../apps/web/src/components/AppShell.tsx), [parser Quick Add](../../apps/web/src/domain/quickAdd.ts).
- **S15:** [raport wydajności](../performance/plan-06.md), [testy regresji](../../apps/web/src/app/App.regression.test.tsx), [testy nawigacji](../../apps/web/src/app/NavigationExperience.test.tsx).
- **S16:** [przegląd AI](../../apps/web/src/components/AIGoalReview.tsx), [podgląd AI triage](../../apps/web/src/components/AIInboxTriagePreview.tsx), [testy głównych przepływów](../../apps/web/src/app/App.test.tsx).
