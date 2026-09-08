# Raport 04 — czytelność na telefonie

Data: 8 września 2026  
Status: **lokalnie gotowy, staging oczekuje**

## Baza kodu

- Gałąź: `styling/UI/UX-improvments`
- HEAD przed realizacją: `1759a0e`
- Working tree przed rozpoczęciem był czysty. Zastane poprawki CSS były już częścią HEAD; nie przywracano starej wersji `styles.css`.
- Zakres: U01–U03 z `04-mobile-clarity.md`, z wykorzystaniem rezultatów planów 02 i 03.
- Bez migracji backendu, wdrożenia zdalnego i commita.

## Implementacja lokalna

Plan 02 dostarczył bieżący polski język i resolver kontekstu Działania, a plan 03 — trwałe szkice oraz komunikaty `DraftStatus`. Plan 04 uzupełnia luki prezentacji bez zmiany modelu Projekt → Cel → Działanie:

- Start używa tego samego resolvera w pełnej wersji desktopowej i krótkiej mobilnej (`Cel · …`, `Projekt · …`, `Samodzielne`, `Projekt niedostępny`). Relacje Wiedzy nie są już dublowane pod każdym Działaniem na telefonie.
- Szczegół Celu ma jeden dominujący nagłówek sekcji następnego Działania; usunięto powtarzającą się instrukcję i spłaszczono obramowanie karty kroku.
- Puste relacje pokazują dyskretne `Dodaj materiał`, a istniejące nadal pokazują licznik i zachowują rozwijanie, dodawanie, odłączanie oraz nawigację.
- Szybki wpis postępu ma widoczne etykiety pól, jednoznaczny przycisk `Zapisz postęp`, zachowane `DraftStatus` i komunikat błędu z retry. Mobilny układ jest jednokolumnowy, z dodatkowym miejscem nad dolną nawigacją.
- Zachowano istniejący kontrakt kontrolek mobilnych 44×44 CSS px, focus ring, modal wyszukiwania, Quick Add, filtry/listy, reduced motion i fonty. Nie dodano nowego systemu komponentów ani globalnego redesignu.

Pliki zmienione:

- `apps/web/src/domain/actionContext.ts` i test — kompaktowy opis kontekstu.
- `apps/web/src/pages/StartPage.tsx` — dwie wersje etykiety kontekstu z jednym resolverem.
- `apps/web/src/pages/GoalDetailPage.tsx` — uproszczony następny krok i opisany formularz postępu.
- `apps/web/src/components/ActionKnowledgeRelations.tsx` — `Dodaj materiał` przy zerowej liczbie oraz zgodna nazwa dostępności.
- `apps/web/src/styles.css` — końcowe, addytywne reguły planu 04; zastane reguły pozostały nietknięte.
- `apps/web/src/app/App.regression.test.tsx` — oczekiwanie dla nowej etykiety pustej relacji.

## Porównanie wyglądu

| Obszar | Przed | Po |
| --- | --- | --- |
| Start na telefonie | Kontekst Działania był ukryty przez regułę mobilną; podobne tytuły traciły rozróżnienie. | Jedna krótka, linkowana linia `Cel`/`Projekt`/`Samodzielne`; długie tytuły mogą się zawijać. |
| Następne Działanie | Karta miała dodatkową ramkę i powtórzoną instrukcję. | Został jeden nagłówek, krok i kontrolki; obramowanie jest lżejsze. |
| Wiedza | Pusty stan wyglądał jak `Wiedza · 0`. | Pusty stan prowadzi przez `Dodaj materiał`; licznik istniejących relacji pozostał. |
| Szybki postęp | Kontrolki były bez własnych widocznych etykiet i układały się w jeden wiersz. | Etykiety są widoczne, mobile układa pola pionowo, a zapis i status szkicu są jednoznaczne. |

## Pomiary kontrastu

Pomiary obliczono ze stałych tokenów CSS i rzeczywistych teł aplikacji; nie są certyfikacją całej aplikacji.

| Para | Kontrast | Cel | Wynik |
| --- | ---: | ---: | --- |
| `#f5f7fa` na `#07111f` — tekst główny | 17.64:1 | 4.5:1 | PASS |
| `#b5c0d0` na `#07111f` — tekst pomocniczy | 10.29:1 | 4.5:1 | PASS |
| `#91a0b5` na `#07111f` — tekst wyciszony | 7.12:1 | 4.5:1 | PASS |
| `#f5f7fa` na `#0b1727` — tekst na karcie | 16.78:1 | 4.5:1 | PASS |
| `#60a5fa` na `#0b1727` — focus ring | 7.08:1 | 3:1 | PASS |
| `#2563eb` na `#fff` — tekst przycisku primary | 5.17:1 | 4.5:1 | PASS |
| `#2b3d56` na `#0b1727` — zwykła granica karty | 1.63:1 | 3:1, jeśli granica jest istotnym wskaźnikiem | Ograniczenie: granica pozostaje dekoracyjna; stan focus używa jaśniejszego ringa. |

## Kontrole automatyczne

| Kontrola | Wynik | Dowód |
| --- | --- | --- |
| Testy celowane | PASS | `vitest run src/app/App.regression.test.tsx src/app/NavigationExperience.test.tsx src/domain/actionContext.test.ts` — 3 pliki, 42 testy |
| Pełne testy | PASS | `pnpm test` — 50 plików, 280 testów |
| Lint | PASS | `pnpm lint` |
| Typy | PASS | `pnpm typecheck` |
| Build demo | PASS | `VITE_DATA_BACKEND=demo pnpm build` — 1997 modułów przekształconych |
| Budżet bundla | PASS | `pnpm check:bundle` |
| Spójność diffu | PASS | `git diff --check` |

## Weryfikacja w przeglądarce — lokalnie

Wykorzystano istniejącą kartę Codex In-app Browser na `http://localhost:5173/` po przeładowaniu aktualnego dev servera.

- Start: PASS jako mobilny spot-check — widoczny pierwszy ekran z `Najważniejsze teraz`, `Na dziś` i dolną nawigacją; brak poziomego przepełnienia w obserwowanym wąskim widoku.
- Szczegół Działania: PASS jako mobilny spot-check — istniejące działanie bez relacji pokazało kontekst `Samodzielne Działanie` oraz przycisk `Dodaj materiał` w AX tree.
- Szczegół Celu: PASS jako mobilny spot-check — hierarchia Celu i sekcji `Następne Działanie` jest czytelna; AX tree ujawnił `Rodzaj aktualizacji`, `Treść aktualizacji` i `Zapisz postęp`.
- Pusty następny krok: widoczny i poprawnie opisany w danych demo. Ten konkretny workspace nie ma obecnie wybranego następnego Działania, więc nie wykonano wizualnego spot-checku karty z aktywnym krokiem.
- Loading i błąd braku Celu: zaobserwowano ekran ładowania po reloadzie oraz kontrolowany komunikat `Nie znaleziono Celu` z przyciskiem powrotu.

Nie udało się wiarygodnie ustawić ani odczytać z narzędzia dokładnych viewportów 320, 390, 430 px, widoku desktopowego 1280×720, powiększenia 200% ani otwartej klawiatury ekranowej. Nie traktuję więc tych punktów jako PASS. Nie wykonano też testu na fizycznym telefonie. Etykiety, focus i retry są sprawdzone w testach komponentów/regresji oraz w kodzie istniejących modali i DraftStatus, ale interakcja z prawdziwą klawiaturą pozostaje otwarta.

## Odbiór względem planu

- [x] Kontekst Działania na mobilnym Starcie ma krótką, rozróżniającą etykietę; pusta Wiedza ma `Dodaj materiał`.
- [x] Formularz postępu zachowuje szkic, błąd/retry i czytelny przycisk; etykiety są dostępne w AX tree.
- [x] Desktopowe selektory pełnej etykiety i istniejące funkcje relacji zostały zachowane w kodzie; build i testy są zielone.
- [ ] Dokładne 320/390/430 px, 200% zoom, klawiatura ekranowa i fizyczny telefon — brak narzędzi/urządzenia w tej sesji.
- [ ] Staging i produkcja — brak dostępu; pozostaje do planu 09.

## Staging

Nie weryfikowano. Nie wykonano zdalnej migracji ani testów na realnym koncie/workspace.

## Produkcja

Nie wdrażano i nie weryfikowano. Nie wykonano publikacji, `migration repair` ani commita.

## Odstępstwa i ograniczenia

- Brak kontroli viewportu i prawdziwego telefonu ogranicza wizualny odbiór dokładnych szerokości, 200% zoomu i klawiatury ekranowej; są to konkretne punkty do domknięcia w planie 09.
- Pomiary kontrastu dotyczą tokenów i użytych teł, nie pełnego audytu wszystkich stanów aplikacji.
- Lokalna karta korzysta z aktualnych danych demo, w których nie ma aktywnie wybranego następnego Działania; nie zmieniano danych tylko na potrzeby zrzutu.
