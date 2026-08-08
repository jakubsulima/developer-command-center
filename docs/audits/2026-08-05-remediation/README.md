# Audyt końcowy realizacji UIX-01–UIX-19

Data: 5 sierpnia 2026  
Backlog: [`ui-ux-remediation-backlog.md`](../../planning/ui-ux-remediation-backlog.md)  
Punkt odniesienia: [`AUDYT-UI-UX.md`](../2026-08-04-ui/AUDYT-UI-UX.md)

## Wynik

Zakres implementacyjny i techniczna weryfikacja UIX-01–UIX-19 są ukończone w
trybie demo i w kontrakcie repozytorium Supabase. Finalny zestaw 15 screenshotów
został wykonany na aktualnym buildzie w viewportach 1440×1000 i 390×844.
Cztery decyzje oznaczone w backlogu jako HITL pozostają do formalnej akceptacji
właściciela produktu.

## Dowody według ticketu

| Ticket | Dostarczony rezultat |
|---|---|
| UIX-01 | Zakładki i historia Inboxu, przywracanie, termin w strefie Workspace'u oraz idempotentne `release_due_inbox_items`. |
| UIX-02 | Kanoniczny `/knowledge/:id`, redirect starego adresu, szczegóły, pochodzenie z Inboxu, backlinki i atomowa edycja encji z treścią. |
| UIX-03 | Produkcyjny capture ograniczony do Tekstu i Linku; normalizacja URL oraz blokada niepełnych `voice/file` także w domenie. |
| UIX-04 | Zwykłe Działanie z Dzisiaj, przypinanie/odpinanie i dokładne Undo. |
| UIX-05 | Wspólny komponent głównych akcji, lokalne mutacje per Działanie; na mobile wyłącznie Ukończ, Następne i Więcej z dostępnym arkuszem. |
| UIX-06 | Checklisty ze stabilnymi ID, zachowaniem postępu, wersją rekordu, konfliktem i rollbackiem. |
| UIX-07 | Edycja Celu i kryteriów oraz transakcyjne zakończenie z historią; porzucenie wymaga powodu. |
| UIX-08 | Jednoznaczne etykiety, walidacja per pole i atomowe tworzenie Celu, kryteriów i pierwszego Działania. |
| UIX-09 | Filtry w URL, semantyka `aria-pressed`, licznik, sygnały kart i mobilny arkusz Filtry. |
| UIX-10 | Wspólny `CaptureComposer`, trwały draft, Cmd/Ctrl+Enter, retry i ochrona przed wieloklikiem. |
| UIX-11 | `useKeyedMutation`, lokalny loading/error/retry, globalne ogłaszanie błędu i skeletony list. |
| UIX-12 | Dostępny `MultiCombobox`, wiele Celów, badge typu na mobile i atomowy diff relacji Wiedzy bez duplikatów. |
| UIX-13 | Mobilny formularz serii z sekcją Więcej opcji, sticky CTA i polskim podglądem dat; tworzenie, edycja przyszłych wystąpień i status serii są atomowymi RPC. |
| UIX-14 | Centralny builder deep linków dla Celu, Działania, Wiedzy i każdego stanu Inboxu; zapytanie wyszukiwarki jest zachowane. |
| UIX-15 | Mobilny nagłówek, menu Workspace, wyszukiwanie w osobnym panelu i aktualizowany badge Inboxu. |
| UIX-16 | Dialogi Działania używają wspólnego `Modal`, focus trap i `closeDisabled` podczas zapisu. |
| UIX-17 | Nazwy kontrolek ikonowych, focus ring, stan wyboru i cele dotykowe minimum 44 px. |
| UIX-18 | Wspólny polski słownik; Archiwum/Undo oraz wyróżniony Kosz i „Anuluj Działanie”. |
| UIX-19 | Kontekstowe empty states, wyrównane karty oraz hover/focus dla akcji desktopowych. Odświeżono komplet 15 zrzutów; review HITL pozostaje otwarte. |

## Bramki jakości

- `pnpm lint` — OK.
- `pnpm typecheck` — OK.
- `pnpm test` — 26 plików, 131 testów, wszystkie OK; w tym 10 testów migracji/RPC SQL.
- `pnpm build` — OK; dodatkowo Vite zbudowany bez ostrzeżenia przy użyciu bundlowanego Node.
- Browser smoke, overlay i overflow — OK na aktualnym buildzie dla `/`,
  `/goals`, `/goals/fintrack-api`, `/inbox` oraz `/knowledge` w 1440×1000 i
  390×844; brak błędów strony w sesji przeglądarkowej.
- Mobilny modal serii — brak poziomego overflow dla dialogu i selektora dni
  tygodnia przy 390×844.

## Finalny zestaw 15 zrzutów

Pliki 01–07 i 15 mają dokładnie 1440×1000 px. Pliki 08–14 mają dokładnie
390×844 px. Każdy zrzut pochodzi z aktualnego lokalnego builda po końcowym
smoke teście.

| # | Widok | Plik |
|---:|---|---|
| 01 | Dzisiaj — desktop | [`01-today-desktop.jpg`](01-today-desktop.jpg) |
| 02 | Cele — desktop | [`02-goals-desktop.jpg`](02-goals-desktop.jpg) |
| 03 | Nowy Cel | [`03-new-goal-modal.jpg`](03-new-goal-modal.jpg) |
| 04 | Szczegóły Celu — desktop | [`04-goal-detail-desktop.jpg`](04-goal-detail-desktop.jpg) |
| 05 | Inbox — desktop | [`05-inbox-desktop.jpg`](05-inbox-desktop.jpg) |
| 06 | Wiedza — desktop | [`06-knowledge-desktop.jpg`](06-knowledge-desktop.jpg) |
| 07 | Nowy element Wiedzy | [`07-new-knowledge-modal.jpg`](07-new-knowledge-modal.jpg) |
| 08 | Dzisiaj — mobile | [`08-today-mobile.jpg`](08-today-mobile.jpg) |
| 09 | Cele — mobile | [`09-goals-mobile.jpg`](09-goals-mobile.jpg) |
| 10 | Szczegóły Celu — mobile | [`10-goal-detail-mobile.jpg`](10-goal-detail-mobile.jpg) |
| 11 | Inbox — mobile | [`11-inbox-mobile.jpg`](11-inbox-mobile.jpg) |
| 12 | Wiedza — mobile | [`12-knowledge-mobile.jpg`](12-knowledge-mobile.jpg) |
| 13 | Seria cykliczna — mobile | [`13-recurring-modal-mobile.jpg`](13-recurring-modal-mobile.jpg) |
| 14 | Globalne przechwycenie — mobile | [`14-quick-capture-mobile.jpg`](14-quick-capture-mobile.jpg) |
| 15 | Wyszukiwanie globalne | [`15-global-search-results.jpg`](15-global-search-results.jpg) |

## Checkpoint HITL

Do zatwierdzenia pozostają decyzje już zaimplementowane zgodnie z rekomendacją
backlogu:

1. UIX-03 — pierwszy release tworzy tylko Tekst i Link; stare Voice/File są wyłącznie odczytywane.
2. UIX-07 — Osiągnięty pokazuje kryteria i otwarte Działania, a Porzucony wymaga powodu.
3. UIX-18 — polski słownik, odwracalne Archiwum/Undo oraz wyróżniony Kosz i ryzykowne zmiany.
4. UIX-19 — akceptacja odświeżonych 15 zrzutów w viewportach 1440×1000 i
   390×844.

Migracja `20260805193000_ui_ux_remediation_commands.sql` została zastosowana
6 sierpnia 2026 do zdalnego projektu Supabase `command`. Historia migracji,
obecność kluczowych RPC oraz transakcyjny smoke test utworzenia Celu jako
członek Workspace zostały zweryfikowane po wdrożeniu.
