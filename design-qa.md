# Kontrola redesignu A / Focus

Data: 12 września 2026. Zakres: szczegóły pojedynczego Działania, Celu i Wiedzy.

## Referencja i decyzje

- [Makieta A](docs/planning/assets/focus-detail-redesign-A.png).
- [Plan](docs/planning/2026-09-12-focus-detail-redesign.md), z późniejszą decyzją użytkownika o zachowaniu granatowo-niebieskiej palety.
- Porównanie dotyczy hierarchii, proporcji sekcji i rozmieszczenia operacji. Przykładowe treści, liczby i daty makiety nie zastępują danych aplikacji.

## Rozbieżności poprawione w tej iteracji

1. Działanie: uporządkowany kontekst nadrzędny, płaskie sekcje opisu, materiałów i rezultatów, pełna szerokość głównego przycisku. Dłuższe grupy powiązań mają rozwijanie; formularz łączenia jest zwinięty.
2. Cel: zwarta karta następnego kroku, usunięte powielone kryteria oraz podwójna wizualizacja checkboxów. Edycja wyróżnionego Działania jest dostępna w menu. Jego szczegółowe powiązania są dostępne po przejściu do Działania. Kryteria są stale widoczne, historia i pozostałe grupy zwijane.
3. Wiedza: treść ma pierwszeństwo, Projekty i pozostałe relacje tworzą jedną sekcję Powiązania. Zachowane zostały potwierdzenia decyzji i obsługa relacji. Brak daty nie jest zastępowany bieżącą datą.
4. Wspólny układ: spójne marginesy, separatory, typografia, nagłówek mobilny i nawigacja. Desktop wykorzystuje dwie kolumny; wąski ekran układa sekcje pionowo.
5. Interakcje: wybór następnego Działania kieruje fokus do właściwej kontrolki; formularz postępu otrzymuje fokus po otwarciu.

## Dowody wizualne

W katalogu [zrzutów](docs/design/focus-detail-redesign/) znajdują się obrazy przed i po zmianie. Końcowe pliki demo mają nazwy `{goal,action,knowledge}-{360,390,768,1440}.png` w podkatalogu `after`.

| Ekran | Demo, 390 px | Dane użytkownika, 390 px | Desktop, 1440 px |
| --- | --- | --- | --- |
| Działanie | [zrzut](docs/design/focus-detail-redesign/after/action-390.png) | [zrzut](docs/design/focus-detail-redesign/after/real-action-390.png) | [zrzut](docs/design/focus-detail-redesign/after/action-1440.png) |
| Cel | [zrzut](docs/design/focus-detail-redesign/after/goal-390.png) | [zrzut](docs/design/focus-detail-redesign/after/real-goal-390.png) | [zrzut](docs/design/focus-detail-redesign/after/goal-1440.png) |
| Wiedza | [zrzut](docs/design/focus-detail-redesign/after/knowledge-390.png) | [zrzut](docs/design/focus-detail-redesign/after/real-knowledge-390.png) | [zrzut](docs/design/focus-detail-redesign/after/knowledge-1440.png) |

Makietę i trzy końcowe widoki mobilne obejrzano wspólnie. Sprawdzono szerokości 360, 390, 768 i 1440 px; brak poziomego przepełnienia. [Pomiary DOM](docs/design/focus-detail-redesign/viewport-checks.json) obejmują 360, 768 i 1440 px. Formularz edycji sprawdzono na demo: otwarcie z menu, anulowanie i powrót fokusu. Formularz postępu sprawdzono pod kątem otwarcia i fokusu. Konsola przeglądarki nie zwróciła błędów podczas końcowej kontroli. Dane użytkownika były tylko odczytywane.

## Weryfikacja techniczna i granice

- Pełny zestaw: 55 plików, 341 testów zakończonych powodzeniem.
- Lint, TypeScript i build: zakończone powodzeniem.
- `git diff --check`: bez błędów.
- Ręczna kontrola nie obejmowała wszystkich kombinacji błędów sieciowych ani wszystkich urządzeń. Stany funkcjonalne obejmują także istniejące testy regresji.
- Różne długości tekstu i puste relacje celowo zmieniają wysokość sekcji względem makiety. Nie deklarujemy zgodności piksel w piksel z wygenerowanym obrazem.
- Listy Projektów i ekran szczegółowy Projektu pozostają poza zakresem planu A.

final result: passed

Wynik dotyczy opisanego zakresu układu i zachowanej palety, po dwóch rundach korekt i kontroli na demo oraz danych użytkownika.
