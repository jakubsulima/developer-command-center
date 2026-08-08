# Uproszczenie dodawania — 2026-08-07

## Zakres i cel użytkownika

Audyt łączy ocenę UX i widocznych ryzyk dostępności dla najczęstszej pętli:
`Dzisiaj → dodanie treści → Działanie, Cel albo Inbox`. Celem było ograniczenie
liczby decyzji, przejść między ekranami i ponownego wpisywania tej samej treści.

## Kroki i stan

1. **Dzisiaj — punkt wejścia** (`01-today-current.png`) — zdrowy wizualnie, ale
   globalne „Przechwyć” sugerowało tylko Inbox, podczas gdy osobne przyciski
   tworzyły Działanie i Cel w innych miejscach.
2. **Globalne przechwycenie** (`02-global-capture-current.png`) — proste i
   dostępne z klawiatury, lecz zawsze dodawało kolejny element do późniejszego
   triage, nawet gdy intencja była już znana.
3. **Pełny formularz Celu** (`04-new-goal-current.png`) — dobry do świadomego
   dopracowania Celu, ale zbyt ciężki jako jedyna droga dla krótkiej intencji.
4. **Nowe szybkie dodawanie — desktop** (`05-quick-add-desktop.png`) — jeden
   punkt wejścia pozwala wybrać Działanie, Cel albo Inbox i zachowuje kontekst
   bieżącego widoku.
5. **Komenda `/cel`** (`06-quick-add-command-goal.png`) — zdrowy; prefiks
   przełącza tryb i jest usuwany z treści, więc użytkownik nie poprawia pola
   ręcznie.
6. **Nowe szybkie dodawanie — mobile** (`07-quick-add-mobile.png`) — zdrowy;
   formularz mieści się w dolnym arkuszu, zachowuje duże cele dotykowe i
   eksponuje jedną główną akcję.
7. **Wynik zapisu** (`08-quick-add-success-mobile.png`) — zdrowy; modal znika,
   bieżący ekran pozostaje, a komunikat jednoznacznie potwierdza utworzenie.

## Najważniejsze usprawnienia

- jeden globalny przycisk „Dodaj” zamiast globalnego wejścia wyłącznie do Inboxu;
- Działanie, Cel i Inbox powstają z jednego podstawowego pola;
- skrót `⌘/Ctrl+J`, zapis `⌘/Ctrl+Enter` i komendy `/zadanie`, `/cel`, `/inbox`;
- opcjonalny Cel lub Projekt bez osobnego kroku konfiguracji;
- Działanie jest domyślnie widoczne w Dzisiaj, ale można to wyłączyć;
- wersja robocza przetrwa przypadkowe zamknięcie;
- po zapisie widoczny jest krótki komunikat sukcesu bez zmiany ekranu.

## Dostępność i ograniczenia dowodów

Widoczne kontrole mają programowe etykiety, stan wyboru `aria-pressed`,
obsługę klawiatury, widoczny fokus i cele dotykowe co najmniej 44 px na mobile.
Zrzuty nie potwierdzają pełnej zgodności WCAG: czytnik ekranu, powiększenie
200–400%, tryb wysokiego kontrastu i pełna kolejność fokusu wymagają osobnych
testów manualnych. Przepływ sprawdzono w lokalnym trybie demo; integracja
Supabase korzysta z tych samych istniejących komend Store, ale nie była w tym
przebiegu zapisywana do zdalnego Workspace'u.
