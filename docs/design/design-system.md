# Kierunek wizualny i projektowanie z AI

## Cel

Interfejs ma przypominać spokojne centrum operacyjne, a nie rozbudowany panel analityczny. Najważniejsze pytanie każdego ekranu brzmi:

> Co powinienem zrobić teraz i jak szybko odzyskać kontekst?

Punkty odniesienia:

- [ulepszony dashboard desktop v2](./command-dashboard-concept-v2.png);
- [mobilny przepływ Command, Focus i Capture](./mobile-command-flow.png);
- [pierwszy koncept dashboardu](./command-dashboard-concept.png) zachowany do porównania;
- [zaakceptowany fundament UI: biblioteki, fonty i tokeny](./ui-foundation-decision.md).

## Hierarchia ekranu Command

1. **Aktualny fokus** — pojedynczy rezultat, następny krok i wznowienie sesji.
2. **Aktywne Commitments** — maksymalnie trzy elementy aktualnego WIP, z wyraźnie
   oznaczonym Primary Commitment.
3. **Checkpointy kontekstu** — branch, plik, ostatni stan i następna akcja.
4. **Nauka oparta na dowodach** — ćwiczenia, artefakty, feedback i retencja.
5. **AI Assistant** — propozycje działań oddzielone od właściwych danych.
6. **Inbox/Quick Capture** — przechwycenie bez konieczności natychmiastowej klasyfikacji.
7. **Review** — przypomnienie prowadzące do decyzji, nie dekoracyjny wykres.

## Układ

- Desktop-first, szerokość referencyjna 1440–1600 px.
- Lewa nawigacja: 224–240 px.
- Prawy panel kontekstowy: 300–340 px.
- Środkowa kolumna: elastyczna, maksymalnie około 1000 px.
- Bazowa siatka odstępów: 4 px.
- Skala odstępów: 4, 8, 12, 16, 24, 32 i 48 px.
- Maksymalnie trzy poziomy powierzchni: canvas, panel, element interaktywny.
- Promień: 8 px dla kontrolek, 12 px dla paneli.
- Cień tylko dla elementów unoszących się nad interfejsem; zwykłe panele oddziela border.

## Tokeny wizualne

```css
:root {
  --canvas: #07111f;
  --surface-1: #0b1727;
  --surface-2: #101e31;
  --surface-elevated: #16263b;
  --surface-hover: #1b2d45;
  --border: #2b3d56;
  --border-control: #526782;

  --text-primary: #f5f7fa;
  --text-secondary: #b5c0d0;
  --text-muted: #91a0b5;

  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --focus-ring: #60a5fa;
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #f87171;

  --radius-control: 8px;
  --radius-panel: 12px;
}
```

Kolor nie może być jedynym nośnikiem statusu. Status otrzymuje również tekst, ikonę albo kształt.

## Typografia

- Geist Sans Variable dla całego UI; waga 400 dla treści, 500 dla etykiet i 600 dla nagłówków.
- Geist Mono Variable wyłącznie dla branchy, plików, skrótów, identyfikatorów, timerów i fragmentów kodu.
- Rozmiary bazowe: 13–14 px dla metadanych, 15–16 px dla treści, 20–24 px dla tytułów sekcji.
- Waga 600 dla tytułów i kluczowych wartości; ograniczać użycie 700.
- Liczby w timerach i metrykach powinny mieć cyfry tabularne.
- Tekst poboczny nie powinien być jaśniejszy od głównego działania.

Dokładna skala typograficzna, sposób self-hostingu fontów i mapowanie tokenów
shadcn znajdują się w [ADR-UI-001](./ui-foundation-decision.md).

## Komponenty charakterystyczne

### Focus Card

Zawiera tylko:

- outcome sesji;
- projekt i kontekst;
- jeden następny krok;
- opcjonalny Effort Budget;
- akcję rozpoczęcia/wznowienia;
- możliwość zapisania checkpointu.

### Project Row

Pokazuje outcome, stan, WIP, następny krok i blocker. Procent postępu jest opcjonalny; nie może być wyliczany ze stosunku zamkniętych zadań, jeżeli nie odpowiada to rzeczywistemu ryzyku projektu.

### Learning Evidence

Postęp pokazuje dowody:

- ukończone ćwiczenia;
- działające artefakty;
- ocenione próby;
- retencję wiedzy;
- luki wymagające kolejnej sesji.

Streak może być informacją drugorzędną, nigdy główną miarą.

### Context Checkpoint

Obowiązkowe pola:

- aktualny stan: gdzie zakończono i co obecnie działa lub nie działa;
- następna fizyczna akcja.

Opcjonalne albo uzupełniane automatycznie:

- blocker;
- aktualny branch, plik, dokument lub URL;
- powiązany Artifact;
- krótka notatka.

### AI Proposal

AI nie imituje zwykłego systemowego powiadomienia. Propozycja musi pokazać:

- co zostanie zmienione;
- dlaczego;
- źródła;
- poziom ryzyka;
- akcje `Zatwierdź`, `Edytuj` i `Odrzuć`.

## Zasady projektowe

- Jeden dominujący cel na ekran.
- Jedna główna akcja w panelu.
- Dashboard pokazuje wyjątki i decyzje, nie wszystkie dostępne dane.
- Informacje nieprowadzące do działania należy przenieść do szczegółów.
- Wykres pojawia się tylko wtedy, gdy umożliwia porównanie albo decyzję.
- Capture ma działać przed klasyfikacją.
- AI nie może przerywać aktualnego focusu niekrytyczną sugestią.
- Widoki mają być projekcjami wspólnych danych, a nie osobnymi listami.
- Animacje powinny potwierdzać zmianę stanu, a nie dekorować interfejs.
- Każdy ekran musi działać klawiaturą i zachowywać czytelny focus ring.

## Udoskonalenia w desktop v2

W porównaniu z pierwszym konceptem:

- następny krok otrzymał większą wagę niż timer;
- stały, długi plan AI został zastąpiony zwiniętą propozycją;
- procenty ukończenia projektów zastąpiły status, blocker i następna decyzja;
- dodano jawny limit WIP;
- ogólne statystyki nauki zastąpiły konkretne dowody postępu i następna sesja;
- checkpoint można utworzyć bez opuszczania aktualnego focusu;
- uproszczono review oraz quick capture;
- zwiększono czytelność tekstów drugorzędnych.

Panel AI powinien rozwijać się jako drawer, modal albo osobny widok dopiero po
akcji użytkownika. Sam fakt pojawienia się propozycji nie może przesuwać głównej
pracy ani zmieniać szerokości dashboardu.

## Projekt mobilny

Mobilny interfejs nie jest pomniejszonym desktopem. Służy przede wszystkim do:

1. sprawdzenia aktualnego focusu i następnego kroku;
2. rozpoczęcia lub wznowienia sesji;
3. szybkiego capture tekstu, głosu, linku albo pliku;
4. zapisania checkpointu;
5. krótkiej akceptacji lub odłożenia propozycji AI.

### Nawigacja

- Stały dolny pasek z pięcioma celami: Dzisiaj, Projekty, Capture, Nauka, Więcej.
- Capture jest centralną akcją, ale nie zasłania treści ani klawiatury ekranowej.
- Inbox, Wiedza, Review i ustawienia znajdują się pod Więcej lub w kontekście.
- Przejście w sesję fokusową zachowuje dolną nawigację tylko wtedy, gdy nie
  zwiększa ryzyka przypadkowego wyjścia; w trybie głębokiego focusu może zostać
  zastąpiona kontrolowanym przyciskiem zamknięcia.

### Ekran Dzisiaj

- Jedna dominująca Focus Card.
- Poza Primary Commitment maksymalnie dwa pozostałe Commitments pokazane bez
  rozwijania pełnej listy.
- Brak tabel i poziomego przewijania.
- AI występuje jako zwinięty wiersz z liczbą propozycji.
- Następny krok musi mieścić się przed pierwszym przewinięciem.

### Sesja fokusowa

- Timer, rezultat i aktualny krok są widoczne jednocześnie.
- Branch, plik i dokumenty występują jako krótkie context chips.
- `Pauza` kończy bieżącą Focus Session po zapisaniu checkpointu; `Wznów` tworzy
  nową sesję dla tego samego Work Itemu.
- Notatka podczas sesji jest Session Scratchpadem, nie pełnym edytorem; trafia do
  Knowledge albo późniejszego kontekstu AI dopiero po świadomej promocji.
- Kolejny krok jest drugorzędny, aby nie rozpraszał obecnego.

### Szybkie przechwycenie

- Treść można zapisać przed wyborem typu i projektu.
- Obsługiwane tryby to tekst, głos, link i plik.
- Klasyfikacja AI jest propozycją, nie częścią obowiązkowego capture.
- Propozycja pokazuje docelowy typ i projekt oraz akcje Zatwierdź, Edytuj, Później.
- Ostatnie elementy pozwalają szybko poprawić błędny capture.

### Dostępność mobilna

- Minimalny touch target: 44 × 44 px; preferowane 48 × 48 px.
- Tekst podstawowy: co najmniej 15–16 px; metadane nie mniejsze niż 13–14 px.
- Zachować safe areas urządzenia i miejsce na klawiaturę ekranową.
- Akcje destrukcyjne nie mogą sąsiadować z główną akcją.
- Swipe może przyspieszać operację, ale każda funkcja musi mieć widoczny odpowiednik.
- Kontrast tekstu należy potwierdzić automatycznym testem WCAG w prototypie.

## Proces projektowania z AI

### 1. Najpierw scenariusz, później wygląd

Każdy ekran zaczyna się od krótkiej specyfikacji:

```text
Użytkownik:
Sytuacja:
Decyzja do podjęcia:
Najważniejsza akcja:
Potrzebny kontekst:
Stan pusty:
Stan błędu:
Stan po wykonaniu:
```

AI może pomóc znaleźć brakujące stany, ale nie powinno samo wymyślać celu ekranu.

### 2. Generować warianty struktury, nie losowe style

Dla jednego scenariusza generować maksymalnie trzy wireframe’y:

- wariant skoncentrowany na działaniu;
- wariant skoncentrowany na kontekście;
- wariant kompaktowy.

Wszystkie korzystają z tych samych danych i ograniczeń. Dzięki temu porównywana jest architektura informacji, a nie atrakcyjność przypadkowej palety.

### 3. Zamrozić tokeny i komponenty

Po wyborze struktury AI nie powinno ponownie projektować:

- kolorów;
- typografii;
- odstępów;
- promieni;
- podstawowych kontrolek.

Kolejne prompty wskazują istniejące tokeny i komponenty. Nowy komponent powstaje tylko wtedy, gdy nie da się złożyć zachowania z istniejących.

### 4. Przechodzić szybko do działającego prototypu

Obraz służy do znalezienia kierunku. Właściwym źródłem prawdy powinien zostać prototyp w kodzie lub plik projektowy z komponentami. W kodzie należy osobno sprawdzić:

- responsywność;
- długie polskie teksty;
- stany loading/empty/error;
- obsługę klawiatury;
- kontrast;
- realne dane zamiast idealnych przykładów.

### 5. Używać AI do krytyki

Przed akceptacją ekranu wykonać trzy oddzielne przeglądy:

1. **UX:** czy użytkownik wie, co zrobić dalej?
2. **Dostępność:** czy kolejność, kontrast i focus są poprawne?
3. **Spójność:** czy ekran używa istniejących tokenów i wzorców?

AI powinno wskazywać problemy wraz z konkretnym miejscem i konsekwencją, zamiast generować ogólne oceny typu „wygląda nowocześnie”.

## Szablon promptu do kolejnych ekranów

```text
Zaprojektuj ekran [nazwa] dla aplikacji będącej centrum dowodzenia developera.

Cel użytkownika:
[jedna decyzja lub rezultat]

Najważniejsza akcja:
[jedna akcja]

Dane wejściowe:
[lista realnych pól]

Stany:
loading, empty, error, partial data, success

Użyj istniejącego systemu:
- ciemny canvas #07111f
- panele #0b1727
- border #2b3d56
- primary #2563eb
- font Geist Sans / Geist Mono dla danych technicznych
- siatka odstępów 4 px
- radius 8/12 px
- spokojny, desktop-first, bez glassmorphismu i gamifikacji

Zachowaj komponenty:
Focus Card, Project Row, Learning Evidence, Context Checkpoint, AI Proposal.

Najpierw popraw hierarchię informacji. Nie dodawaj wykresów, ilustracji ani metryk,
jeśli nie pomagają podjąć decyzji.
```

## Następne ekrany do zaprojektowania

1. Project Workspace.
2. Learning Path.
3. Inbox Triage.
4. Focus Session.
5. Weekly Review.
6. Global Search/Command Palette.
7. Mobilny Quick Capture.
