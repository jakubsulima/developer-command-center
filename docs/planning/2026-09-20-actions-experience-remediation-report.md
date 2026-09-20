# Raport wdrożenia: spójne i czytelne Działania

Data odbioru: 20 września 2026.  
Plan: [2026-09-20-actions-experience-remediation.md](./2026-09-20-actions-experience-remediation.md)

## Zrealizowany zakres

- dodano wspólne formatowanie dat Działań, względne etykiety terminu i
  rozwiązywanie nazwy Rutyny;
- dodano `ActionSignals` i zastosowano go na `/actions`, Starcie, w Projekcie,
  Celu oraz szczególe Działania;
- wydzielono współdzielony `ActionEditDialog` z trwałym szkicem, checklistą,
  obsługą wersji, błędu i blokadą podwójnego zapisu;
- szczegół Działania umożliwia edycję, pokazuje pełną blokadę i otwiera jej
  edytor bezpośrednio;
- Cel pokazuje „Pozostałe Działania” i licznik tej samej kolekcji, którą
  renderuje, z wyłączeniem następnego kroku;
- Projekt pokazuje status tekstem, termin/zaległość, blokadę i nazwę Rutyny;
- po odbiorze listy uproszczono hierarchię sygnałów: status otrzymał spokojne
  tło, termin wyższy kontrast, a powód blokady własny podpisany pas zamiast
  kolejnego równorzędnego fragmentu tekstu;
- Quick Add używa pojedynczego wyboru `Dzisiaj | Jutro | Bez terminu | Inna
  data`; przypięcie do Startu pozostaje niezależne;
- usunięto nieużywany wariant kontrolki pokazujący samą ikonę statusu;
- nie dodano migracji ani zmian kontraktów danych.

## Kontrole automatyczne

| Kontrola | Wynik |
| --- | --- |
| Celowane testy prezentacji, Quick Add, Celu, listy i szczegółu | 33/33 |
| `pnpm lint` | zaliczone |
| `pnpm typecheck` | zaliczone |
| `pnpm test` | 59 plików, 370/370 testów |
| `pnpm build` | zaliczone, Vite/PWA zbudowane |

Stan bazowy przed wdrożeniem: 363/364 testów; pojedynczy test oczekiwał braku
tekstowego statusu „Do zrobienia”. Zgodnie z ACT-04 asercja została zmieniona
na sprawdzenie widocznej etykiety i dostępnej operacji statusu.

## Odbiór wizualny

W lokalnej aplikacji `http://localhost:5173/` wykonano zrzuty i kontrolę:

| Powierzchnia | Desktop 1440 × 900 | Mobile 390 × 844 |
| --- | --- | --- |
| Szczegół Działania | status, termin, blokada i edycja widoczne | zaliczone |
| Cel | „Następne Działanie” i „Pozostałe Działania” | zaliczone |
| Projekt | tekstowy status, termin i Rutyna w wierszu | zaliczone |
| Start | tekstowy status, termin i Rutyna bez kolizji | zaliczone |
| Quick Add | radiogroup i niezależny przełącznik Startu | zaliczone |

Dodatkowo przy szerokościach 320 i 768 px sprawdzono Start, Projekt, Cel i
szczegół. Dla wszystkich widoków `documentElement.scrollWidth` nie przekraczał
szerokości viewportu. Zrzuty desktopowe i mobilne zostały dołączone do wyniku
sesji wdrożeniowej.

## Najważniejsze pliki

- `apps/web/src/domain/actionPresentation.ts`
- `apps/web/src/components/ActionSignals.tsx`
- `apps/web/src/components/ActionEditDialog.tsx`
- `apps/web/src/components/ActionStatusControls.tsx`
- `apps/web/src/components/QuickAdd.tsx`
- `apps/web/src/pages/ActionsPage.tsx`
- `apps/web/src/pages/ActionDetailPage.tsx`
- `apps/web/src/pages/GoalDetailPage.tsx`
- `apps/web/src/pages/ProjectDetailPage.tsx`
- `apps/web/src/pages/StartPage.tsx`
