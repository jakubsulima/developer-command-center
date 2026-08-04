# ADR-UI-001: fundament interfejsu

- Status: **zaakceptowane do MVP**
- Data: 2026-07-31
- Zakres: aplikacja webowa/PWA na desktop i mobile
- Powiązane: [kierunek wizualny](./design-system.md),
  [architektura produktu](../research/architecture-recommendation.md)

## Decyzja w skrócie

Interfejs budujemy na **shadcn/ui w stylu `new-york`**, z prymitywami
**Radix**, **Tailwind CSS v4**, ikonami **Lucide** i semantycznymi tokenami CSS.
Tekst interfejsu używa **Geist Sans**, a dane techniczne **Geist Mono**.
Pierwsza wersja ma jeden dopracowany motyw ciemny; kod nie może jednak używać
surowych kolorów, aby późniejsze dodanie motywu jasnego nie wymagało przebudowy
komponentów.

Nie używamy MUI, Ant Design ani Mantine jako głównej biblioteki. Przyspieszyłyby
pierwsze ekrany, ale narzuciłyby zbyt wiele decyzji wizualnych i utrudniły
uzyskanie spokojnego, zwartego interfejsu centrum operacyjnego. Nie budujemy też
od zera dialogów, menu, comboboxów ani obsługi focusu.

## Stos komponentów

| Obszar | Decyzja | Zastosowanie |
| --- | --- | --- |
| Komponenty bazowe | shadcn/ui, `new-york` | przyciski, pola, dialogi, sheet, menu, tooltipy, tabs |
| Prymitywy dostępności | Radix przez wariant shadcn `--base radix` | focus, klawiatura, ARIA, portal i pozycjonowanie |
| Style | Tailwind CSS v4 + CSS custom properties | układ, warianty i semantyczne tokeny |
| Ikony | `lucide-react`, domyślnie 18 px i stroke 1.75 | jeden spójny zestaw ikon |
| Formularze | React Hook Form + Zod | formularze wielopolowe i walidacja domenowa |
| Dane serwerowe | TanStack Query | cache, mutacje, retry i stany sieciowe |
| Tabele | TanStack Table, tylko dla rzeczywistych tabel | sortowanie i kolumny bez narzuconego wyglądu |
| Command palette | komponent shadcn `Command`/cmdk | globalne wyszukiwanie i skróty |
| Powiadomienia | Sonner | krótkie, niedestrukcyjne potwierdzenia |
| Drag and drop | dnd-kit, dopiero gdy potwierdzi go test UX | kolejność elementów, nie główna nawigacja |

Radix wybieramy świadomie mimo tego, że w lipcu 2026 Base UI stało się
domyślną bazą nowych projektów shadcn. Radix jest dojrzalszy, ma więcej
sprawdzonych wzorców w planowanym stosie i ogranicza ryzyko przy interfejsach AI.
Po dodaniu pierwszych komponentów interaktywnych nie zmieniamy bazy w trakcie
MVP.

Punkt startowy dla nowego klienta Vite:

```bash
pnpm dlx shadcn@latest init --template vite --base radix
```

W kreatorze wybieramy CSS variables, styl `new-york`, Geist, Lucide i dark mode.
Repozytorium używa pnpm workspace; nie dokładamy Turborepo, dopóki same skrypty
workspace wystarczają.

### Początkowy zestaw shadcn/ui

Instalujemy komponenty wtedy, gdy są potrzebne, a nie całe repozytorium. Pierwszy
zestaw:

- `button`, `input`, `textarea`, `label`, `checkbox`, `select`;
- `card`, `badge`, `separator`, `skeleton`, `progress`;
- `dialog`, `alert-dialog`, `sheet`, `popover`, `tooltip`;
- `dropdown-menu`, `command`, `tabs`, `scroll-area`;
- `form`, `sonner`, `calendar`.

Nie używamy generycznego `Card` jako kontenera wszystkiego. Dashboard ma trzy
poziomy powierzchni, a granice wynikają przede wszystkim z hierarchii, odstępów
i subtelnych obramowań.

### Warstwy kodu UI

```text
packages/ui/src/
  components/ui/         skopiowane i dostosowane prymitywy shadcn
  components/product/    FocusCard, ProjectRow, ContextCheckpoint, AIProposal
  tokens/                kolory, typografia, spacing i motion

apps/web/src/features/   kompozycje zależne od konkretnego przypadku użycia
```

`components/ui` nie importuje domeny ani klienta Supabase. Komponenty domenowe
składają prymitywy i otrzymują typowane dane oraz callbacki. Kod funkcji nie może
importować bezpośrednio Radix, jeśli istnieje odpowiedni wrapper w `components/ui`.

## Typografia

### Rodziny

- **Geist Sans Variable 100–900** — cały interfejs, treść i nagłówki.
- **Geist Mono Variable 100–900** — kod, branche, ścieżki plików, skróty
  klawiaturowe, identyfikatory, timery i techniczne metryki.
- **Geist Pixel** — nie używamy w produkcie; ma charakter dekoracyjny.

Fonty self-hostujemy jako oficjalne pliki WOFF2 i włączamy `font-display: swap`.
Dzięki temu PWA nie zależy od zewnętrznego serwera fontów. Minimalna konfiguracja:

```css
@font-face {
  font-family: "Geist";
  src: url("/fonts/Geist-Variable.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}

@font-face {
  font-family: "Geist Mono";
  src: url("/fonts/GeistMono-Variable.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}

@theme inline {
  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
}
```

W `@theme inline` używamy literalnych nazw rodzin. Nie mapujemy tam
`--font-sans` z powrotem na inną zmienną `--font-*`, aby uniknąć cyklicznej
referencji w Tailwind v4.

### Skala tekstu

| Token | Rozmiar / line-height | Waga | Użycie |
| --- | --- | --- | --- |
| `display` | 32 / 38 px | 600 | najważniejszy wynik lub tryb focus |
| `page-title` | 28 / 34 px | 600 | tytuł widoku desktop |
| `section-title` | 20 / 28 px | 600 | sekcje i główne panele |
| `card-title` | 16 / 24 px | 600 | tytuł elementu domenowego |
| `body` | 15 / 22 px | 400 | treść desktop |
| `body-mobile` | 16 / 24 px | 400 | treść i inputy mobile |
| `label` | 14 / 20 px | 500 | etykiety i przyciski |
| `meta` | 13 / 18 px | 400 lub 500 | daty i dane drugorzędne |
| `code` | 13 / 20 px | 450 | ścieżki, branch i kod |

Nagłówki mają `letter-spacing: -0.02em`, tekst zwykły `0`, a cyfry timerów
`font-variant-numeric: tabular-nums`. Nie używamy wagi 700 poza pojedynczymi,
krótkimi wartościami. Tekst w polach formularzy na mobile ma co najmniej 16 px.

## Kolory

Kolory są semantyczne, nie przypisane do konkretnych ekranów. W kodzie używamy
`bg-background`, `bg-card`, `text-muted-foreground`, `border-border` itd., nigdy
`bg-[#07111f]` ani `text-blue-500`.

### Paleta źródłowa

| Rola | HEX | Zastosowanie |
| --- | --- | --- |
| Canvas | `#07111F` | tło aplikacji |
| Surface 1 | `#0B1727` | podstawowe panele |
| Surface 2 | `#101E31` | pola grupujące i zagnieżdżenia |
| Surface elevated | `#16263B` | popover, drawer, element podniesiony |
| Hover/selected | `#1B2D45` | hover i zaznaczenie bez statusu |
| Border subtle | `#2B3D56` | podziały i nieinteraktywne obramowania |
| Border control | `#526782` | obrys kontrolki, gdy jest potrzebny do rozpoznania |
| Text primary | `#F5F7FA` | nagłówki i główna treść |
| Text secondary | `#B5C0D0` | opis i kontekst |
| Text muted | `#91A0B5` | metadane; nie używać dla ważnej akcji |
| Primary | `#2563EB` | główna akcja i aktywny stan |
| Primary hover | `#1D4ED8` | hover/pressed głównej akcji |
| Focus ring | `#60A5FA` | widoczny focus klawiatury |
| Success | `#34D399` | pozytywny status i dowód |
| Warning | `#FBBF24` | ostrzeżenie i ryzyko |
| Danger text | `#F87171` | błąd i status destrukcyjny |
| Destructive fill | `#B91C1C` | wypełniony przycisk destrukcyjny |

### Tokeny do implementacji

OKLCH jest wartością źródłową w CSS, zgodnie z Tailwind v4 i shadcn/ui. HEX w
komentarzu służy do komunikacji z narzędziami projektowymi.

```css
:root {
  color-scheme: dark;

  --background: oklch(0.176 0.033 256.4); /* #07111F */
  --foreground: oklch(0.975 0.005 258.3); /* #F5F7FA */

  --card: oklch(0.203 0.037 256); /* #0B1727 */
  --card-foreground: var(--foreground);
  --popover: oklch(0.266 0.045 255.6); /* #16263B */
  --popover-foreground: var(--foreground);

  --primary: oklch(0.546 0.215 262.9); /* #2563EB */
  --primary-foreground: var(--foreground);
  --secondary: oklch(0.233 0.042 256.4); /* #101E31 */
  --secondary-foreground: oklch(0.804 0.026 257.7); /* #B5C0D0 */
  --muted: var(--secondary);
  --muted-foreground: oklch(0.701 0.035 256.8); /* #91A0B5 */
  --accent: oklch(0.294 0.050 256); /* #1B2D45 */
  --accent-foreground: var(--foreground);

  --destructive: oklch(0.505 0.190 27.5); /* #B91C1C */
  --destructive-foreground: var(--foreground);
  --border: oklch(0.356 0.050 256.7); /* #2B3D56 */
  --input: oklch(0.507 0.050 254.9); /* #526782 */
  --ring: oklch(0.714 0.143 254.6); /* #60A5FA */

  --status-success: oklch(0.773 0.153 163.2); /* #34D399 */
  --status-warning: oklch(0.837 0.164 84.4); /* #FBBF24 */
  --status-danger: oklch(0.711 0.166 22.2); /* #F87171 */
  --status-info: var(--ring);

  --radius: 0.75rem;
}
```

Tła badge'y statusowych korzystają z osobnych par:

| Status | Tło | Tekst | Kontrast |
| --- | --- | --- | --- |
| Info | `#142D59` | `#93C5FD` | 7.52:1 |
| Success | `#0B3B2E` | `#6EE7B7` | 8.20:1 |
| Warning | `#49320B` | `#FCD34D` | 8.35:1 |
| Danger | `#4B1D24` | `#FCA5A5` | 7.37:1 |

Sprawdzone kluczowe pary: tekst główny/canvas 17.64:1, tekst
drugorzędny/panel 9.79:1, tekst muted/panel 6.77:1, tekst przycisku/primary
4.82:1 oraz focus/canvas 7.45:1. Cienki border panelu jest separatorem, nie
jedynym sposobem rozpoznania kontrolki. Interaktywna kontrolka wymagająca obrysu
używa `--input`, który osiąga co najmniej 3:1 względem panelu.

## Geometria, gęstość i ruch

- Siatka spacingu: 4 px; wartości: 4, 8, 12, 16, 20, 24, 32, 40 i 48 px.
- Kontrolki desktop: 36 px; główne akcje 40 px.
- Kontrolki mobile: minimum 44 px, preferowane 48 px.
- Radius: 8 px dla kontrolek, 12 px dla paneli, pełne zaokrąglenie tylko dla
  badge'a, avatara i małego przełącznika.
- Cień występuje tylko na popoverze, dialogu i drawerze. Panele na canvasie są
  płaskie.
- Przejścia stanu: 120–180 ms. Drawer/dialog: maksymalnie 240 ms.
- Obsługujemy `prefers-reduced-motion`; informacja nigdy nie zależy od animacji.

Breakpoints opisują zmianę zachowania, nie konkretne urządzenia:

| Tryb | Zakres | Zachowanie |
| --- | --- | --- |
| Mobile | `< 768 px` | dolna nawigacja, karty zamiast tabel, sheet/drawer |
| Compact | `768–1199 px` | zwijany sidebar, bez stałego prawego panelu |
| Desktop | `1200–1439 px` | sidebar i elastyczny obszar główny |
| Wide | `>= 1440 px` | sidebar, główna kolumna i panel kontekstowy |

## Zasady komponentów

Każdy komponent przed użyciem w ekranie musi mieć stany: default, hover, focus,
disabled, loading oraz error, jeśli przyjmuje dane. Komponent domenowy dodatkowo
ma przykłady z długim polskim tekstem, brakiem danych i częściowym offline.

- Jedna karta ma najwyżej jedną akcję primary.
- Ikona bez tekstu zawsze ma dostępny label i tooltip na desktopie.
- Kolor statusu zawsze występuje z etykietą lub ikoną.
- Destrukcja używa `AlertDialog`; zwykły `Dialog` nie udaje potwierdzenia.
- Toast nie przenosi informacji, której nie da się później odzyskać.
- Na mobile tabela zmienia się w listę/karty; nie ściskamy wersji desktopowej.
- AI Proposal nie używa tego samego stylu co komunikat systemowy i zawsze
  pokazuje skutek, źródła, ryzyko oraz decyzję użytkownika.

## Decyzje wymagane przed pierwszym wdrożeniem

Poniższe wartości są rekomendowanym domyślnym wyborem. Zmiana którejkolwiek po
rozpoczęciu implementacji może wpłynąć na model danych, routing albo UI.

| Decyzja | Rekomendacja dla MVP | Kiedy zamknąć |
| --- | --- | --- |
| Główny użytkownik | jedna osoba zarządzająca własną pracą; brak zespołów | przed schematem RLS |
| Zakres pętli MVP | Capture → Shape → Commit → Focus → Checkpoint → Review | przed backlogiem sprintu 1 |
| Miara sukcesu | odzyskanie kontekstu i rozpoczęcie pracy w < 60 s | przed testami UX |
| Mobile | responsywna PWA, bez osobnej aplikacji natywnej | zaakceptowane |
| Motyw | dark-only w MVP, tokeny gotowe na light | zaakceptowane |
| Język i czas | polski, `Europe/Warsaw`; czas w bazie jako UTC | przed modelem dat |
| Offline | capture i odczyt ostatniego focusu; jawny stan synchronizacji | przed service workerem |
| Zapis danych | autosave dla capture/notatek; jawny Save dla zmian strukturalnych | przed formularzami |
| Usuwanie | archiwizacja domyślna + Undo; hard delete tylko w ustawieniach | przed CRUD |
| AI | Read/Suggest; zapis dopiero po akceptacji i pokazaniu diffu | przed API AI |
| Dane wysyłane do AI | minimalny wybrany kontekst, bez sekretów i całego repo | przed integracją modelu |
| Integracje | brak w MVP poza opcjonalnym GitHub read-only | przed OAuth |
| Powiadomienia | in-app; bez push i e-mail w MVP | przed ustawieniami |
| Import/eksport | eksport JSON/Markdown, import po MVP | przed stabilizacją schematu |
| Analityka | tylko zdarzenia produktowe bez treści notatek | przed deploymentem |
| Dostępność | WCAG 2.2 AA, pełna klawiatura i widoczny focus | przed pierwszym PR UI |
| Przeglądarki | bieżąca i poprzednia wersja Chrome, Edge, Firefox i Safari | przed konfiguracją CI |

## Bramka gotowości do implementacji

Nie rozpoczynamy pełnego CRUD-u, dopóki nie istnieją:

1. mapa przepływu dla pięciu etapów MVP i definicja „done” dla każdego etapu;
2. model uprawnień RLS dla jednego użytkownika z możliwością późniejszego
   dodania workspace'u;
3. kontrakty komend domenowych i rozróżnienie autosave od jawnego zapisu;
4. responsywne wireframe'y Command, Focus, Capture i Review;
5. katalog stanów loading, empty, error, offline, stale i permission denied;
6. prototyp podstawowych komponentów z testem klawiatury i kontrastu;
7. budżet AI oraz zasada redakcji sekretów i wrażliwego kontekstu;
8. środowiska lokalne, preview i production wraz z migracjami bazy;
9. minimalny plan testów: Vitest/Testing Library dla logiki komponentów,
   axe dla dostępności i Playwright dla czterech głównych przepływów;
10. decyzja, które zdarzenia mierzymy bez zapisywania treści użytkownika.

## Konsekwencje

Zyskujemy szybkie składanie dostępnych komponentów bez utraty kontroli nad
wyglądem. Kosztem jest odpowiedzialność za utrzymanie skopiowanego kodu shadcn.
Każde użycie CLI aktualizujące istniejący komponent musi być poprzedzone commitem
i przeglądem diffu; nie wykonujemy zbiorczego `--overwrite` na zmodyfikowanych
komponentach.

Motyw jasny, wykresy, rozbudowany rich text, drag and drop, Storybook i osobny
klient natywny są odłożone. Dodajemy je dopiero po wykazaniu potrzeby w testach
MVP, a nie jako część fundamentu.

## Źródła decyzji

- [shadcn/ui — instalacja dla Vite](https://ui.shadcn.com/docs/installation/vite)
- [shadcn/ui — Tailwind CSS v4 i tokeny OKLCH](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui — wybór Radix lub Base UI](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4)
- [shadcn/ui — Base UI jako domyślna baza od lipca 2026](https://ui.shadcn.com/docs/changelog)
- [Geist — oficjalne fonty i licencja OFL](https://github.com/vercel/geist-font)
- [WCAG 2.2 — minimalny kontrast tekstu](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
