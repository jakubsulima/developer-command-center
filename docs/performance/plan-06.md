# Plan 06 — pomiar i utrzymanie wydajności

## Powtarzalny pomiar

```bash
VITE_DATA_BACKEND=demo pnpm build
pnpm check:bundle
pnpm performance:audit-ui
pnpm performance:report -- --baseline docs/performance/plan-06-baseline.json
```

Raport runtime zbiera cztery zagregowane metryki bez treści użytkownika:

- `app-start` — od początku nawigacji do interaktywnego Workspace'u;
- `lazy-route-transition` — czas pobrania i przygotowania lazy route;
- `quick-add-open` — od aktywacji Quick Add do ustawienia fokusu w formularzu;
- `workspace-first-interaction` — opóźnienie od pierwszego pointer/keyboard eventu do następnej klatki.

Profile są kategoryzowane jako `desktop` (powyżej 480 px) i `mobile` (do 480 px), więc scenariusz 390×844 trafia do profilu mobile. W buildzie z `?perf=1` można odczytać agregat przez `window.__commandPerformance()` lub element `#command-performance-debug`. Surowy snapshot można zapisać bez zmian i przekazać bezpośrednio do raportu:

```bash
pnpm performance:report -- --timings /ścieżka/do/timings.json
```

Raport akceptuje również płaski JSON z wartościami w milisekundach; dla surowego snapshotu wylicza średnią ważoną (`totalMs / count`) osobno dla desktopu i mobile.

Reporter wysyła dane dopiero przez istniejący adapter `AppErrorReporter`, tylko gdy skonfigurowano HTTPS endpoint monitoringu. Wysyłany payload zawiera wyłącznie nazwy metryk, statystyki `count/min/max/total`, profil viewportu i bezpieczne nazwy tras.

## Decyzje z audytu

Wyszukiwanie importów w `apps/web/src` nie znalazło użycia dla prymitywów `alert-dialog`, `collapsible`, `command`, `dropdown-menu`, `select` i `separator`; zostały usunięte. Ta decyzja nie dotyka używanego `Modal`, `Tabs`, `Input`, `Textarea`, `Progress`, `Avatar`, `Skeleton` ani wrappera `components/ui.tsx`.

Reguła `.separator-dot` była jedyną regułą bez referencji w kodzie; usunięto ją po wyszukiwaniu. Pozostałych reguł CSS skrypt nie usuwa automatycznie, ponieważ część nazw powstaje dynamicznie lub pochodzi z `@apply`; każda kolejna redukcja wymaga testów i smoke testu wizualnego.

## Wynik po zmianie

Po lazyzacji rzadkiego Quick Add entry zmniejszył się z `112 253 B` do `110 156 B` gzip, a entry CSS z `32 568 B` do `32 404 B`. Quick Add jest osobnym lazy chunkiem `3 465 B` gzip. Limity `check:bundle` pozostają blokujące w CI.
