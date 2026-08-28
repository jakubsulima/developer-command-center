# Krótkie plany wdrożeniowe po audycie produktu

Każdy plik jest samodzielnym zadaniem dla kolejnego czatu. Przekazuj tylko
jeden plan naraz i poproś o implementację oraz pełną weryfikację.

## Rekomendowana kolejność

1. [Start i dodawanie bez zbędnego wysiłku](./plan-01-daily-use-simplicity.md)
2. [Gotowość dla pierwszych realnych użytkowników](./plan-02-real-user-readiness.md)
3. [Asystowane przez AI porządkowanie Skrzynki](./plan-03-ai-inbox-triage.md)
4. [Przechwytywanie offline](./plan-04-offline-capture.md) — gdy mobile jest ważny
5. [Uproszczenie szczegółu Celu i języka](./plan-05-goal-detail-and-language.md)
6. [Pomiar i utrzymanie wydajności](./plan-06-performance-headroom.md)

Plan 2 wymaga dostępu do testowego środowiska Supabase, aby zamknąć część
produkcyjną. Plan 3 powinien ruszyć dopiero po uproszczeniu ręcznego przepływu
w Planie 1. Plan 4 jest warunkowy: warto go realizować, jeśli aplikacja ma być
regularnie używana mobilnie przy niestabilnym połączeniu.

## Jak przekazać plan

Przykład wiadomości w nowym czacie:

> Zaimplementuj plan z `docs/planning/plan-01-daily-use-simplicity.md`.
> Najpierw sprawdź aktualny stan, potem wykonaj cały zakres, uruchom wskazane
> kontrole i opisz różnice względem kryteriów akceptacji.

