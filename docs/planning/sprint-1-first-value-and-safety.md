# Sprint 1 — pierwsza wartość i bezpieczeństwo

## Cel sprintu

Nowy użytkownik ma przejść od pustego Workspace'u do pierwszej Focus Session
bez wcześniejszej znajomości modelu domenowego. Każda istotna zmiana musi jasno
pokazywać, czy została zapisana, a operacje ryzykowne mają być odwracalne albo
potwierdzane.

## Rezultat demonstracyjny

Na pustym Workspace użytkownik opisuje rezultat i pierwszy krok, rozpoczyna
Focus, zapisuje notatkę w scratchpadzie, odświeża stronę bez utraty treści, a po
przypadkowym przeniesieniu obiektu do Trash może cofnąć operację.

## Poza zakresem

- rozbudowana analityka produktowa i zewnętrzne narzędzia telemetryczne;
- przebudowa modelu Project/Commitment;
- generowanie treści przez AI;
- pełny tryb offline;
- redesign całej aplikacji.

## Punkty startowe w repozytorium

- `apps/web/src/pages/CommandPage.tsx`
- `apps/web/src/pages/ProjectsPage.tsx`
- `apps/web/src/pages/FocusPage.tsx`
- `apps/web/src/components/Modal.tsx`
- `apps/web/src/app/store.tsx`
- `apps/web/src/data/localWorkspaceRepository.ts`
- `apps/web/src/data/supabaseRepository.ts`
- `apps/web/src/app/App.regression.test.tsx`
- `docs/design/design-system.md`

## S1-01 — Prowadzony pierwszy Focus

**Typ:** HITL  
**Złożoność:** L  
**Blocked by:** brak

### Co zbudować

Zastąp pusty Command prowadzonym przepływem, który zbiera nazwę rezultatu i
pierwszą fizyczną akcję, tworzy wymagane obiekty przez istniejącą komendę
tworzenia projektu, a następnie pozwala od razu rozpocząć Focus. W copy używaj
prostego języka, pokazując pojęcia Outcome i Work Item jako objaśnienia, nie jako
warunek zrozumienia formularza.

### Kryteria akceptacji

- [ ] Pusty Workspace pokazuje jedną dominującą akcję „Rozpocznij pierwszy fokus”.
- [ ] Przepływ wymaga tylko opisu rezultatu i pierwszej konkretnej akcji.
- [ ] Utworzenie nadal respektuje atomową komendę Project + Outcome + Work Item + Commitment.
- [ ] Po sukcesie użytkownik może jednym kliknięciem rozpocząć utworzony Work Item.
- [ ] Błąd zapisu nie zamyka kreatora i nie usuwa wpisanej treści.
- [ ] Cofnięcie się między krokami nie usuwa danych.
- [ ] Przepływ jest obsługiwalny klawiaturą i działa na szerokości mobilnej.
- [ ] Istnieje test pustego Workspace'u od Command do uruchomionej Focus Session.

### Checkpoint HITL

Pokaż desktop i mobile oraz poproś o ocenę: języka pytań, liczby kroków i tego,
czy użytkownik rozumie różnicę między rezultatem a pierwszą akcją.

## S1-02 — Trwałe wersje robocze formularzy

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** S1-01 dla formularza onboardingu; pozostałe formularze bez blokady

### Co zbudować

Zachowuj wersje robocze długich formularzy i scratchpadu w zakresie właściwego
Usera/Workspace'u. Przywracaj je po przeładowaniu lub przypadkowym zamknięciu
modala, a usuwaj dopiero po udanym zapisie albo świadomym „Odrzuć wersję
roboczą”.

### Kryteria akceptacji

- [ ] Draft obejmuje onboarding, tworzenie Projectu, checkpoint i Review summary.
- [ ] Scratchpad zachowuje treść bez wymagania ręcznego zapisu.
- [ ] Draft jest rozdzielony co najmniej przez Workspace i rodzaj formularza.
- [ ] Udany submit usuwa właściwy draft, nie inne wersje robocze.
- [ ] Błąd repozytorium pozostawia draft i pozwala ponowić zapis.
- [ ] UI pokazuje „Zapisywanie…”, „Wersja robocza zapisana” lub błąd.
- [ ] Test obejmuje reload, udany submit, błąd i brak wycieku między kontekstami.

## S1-03 — Odwracalne akcje i dostępny undo

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** brak

### Co zbudować

Dodaj wspólny mechanizm komunikatu o sukcesie z akcją undo dla zmian
widoczności i prostych statusów, które już są odwracalne domenowo. Undo ma
wykonać zwykłą komendę kompensującą, a nie usuwać Activity Event.

### Kryteria akceptacji

- [ ] Archive, przeniesienie do Trash, odrzucenie Inbox Itemu i snooze pokazują wynik.
- [ ] Każda z tych akcji oferuje ograniczone czasowo undo.
- [ ] Undo odtwarza poprzedni stan i relacje przez publiczny kontrakt Store/repository.
- [ ] Komunikat jest dostępny dla czytnika ekranu i nie polega wyłącznie na kolorze.
- [ ] Wiele szybkich operacji nie nadpisuje bezpowrotnie wcześniejszej możliwości cofnięcia.
- [ ] Testy obejmują sukces, undo i błąd komendy kompensującej.

## S1-04 — Osłony operacji wysokiego ryzyka

**Typ:** AFK  
**Złożoność:** M  
**Blocked by:** S1-03

### Co zbudować

Wprowadź AlertDialog dla zmian, które kończą lub istotnie zmieniają pracę:
release Commitmentu, porzucenie celu, przeniesienie Projectu do Trash oraz
opuszczenie niezapisanego przepływu, gdy draft nie może zostać zachowany.
Dialog powinien nazywać skutek, zachowane dane i sposób odzyskania.

### Kryteria akceptacji

- [ ] Dialog pokazuje konkretny obiekt i skutek operacji.
- [ ] Akcja destrukcyjna ma jednoznaczną etykietę, a anulowanie jest bezpiecznym domyślnym wyborem.
- [ ] Focus wraca do kontrolki otwierającej po anulowaniu lub zakończeniu.
- [ ] Podwójne kliknięcie nie wykonuje komendy dwa razy.
- [ ] Błąd pozostawia dialog otwarty z możliwością ponowienia.
- [ ] Testy obejmują anulowanie, potwierdzenie, loading i błąd.

## Kolejność wykonania

1. S1-01
2. S1-02 i S1-03
3. S1-04
4. Wspólny test ścieżki demonstracyjnej na mobile i desktop

## Kontrole jakości

```bash
pnpm lint
pnpm typecheck
pnpm test
VITE_DATA_BACKEND=demo pnpm build
```

Manualnie sprawdź również odświeżenie strony w połowie każdego formularza,
nawigację Tab/Shift+Tab/Escape oraz zachowanie przy symulowanym błędzie zapisu.

## Prompt startowy dla kolejnego chatu

```text
Zrealizuj Sprint 1 opisany w docs/planning/sprint-1-first-value-and-safety.md.
Najpierw przeczytaj cały dokument, CONTEXT.md, ADR 0003, ADR 0004 oraz design
system. Zachowaj istniejące zmiany w worktree. Realizuj tickety w podanej
kolejności jako pełne pionowe wycinki i po każdym uruchom odpowiednie testy.
Zatrzymaj się na checkpoincie HITL S1-01 z gotowym wariantem do oceny. Nie
rozszerzaj zakresu, nie wdrażaj i nie twórz commita bez osobnego polecenia.
```

