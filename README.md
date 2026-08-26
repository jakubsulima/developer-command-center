# Developer Command Center

Responsywna PWA prowadząca pracę i naukę przez pętlę:

`Capture → Project/Goal → Action → Progress → Review`

Interfejs jest oparty na dokumentacji w `CONTEXT.md` oraz makietach w
`docs/design`. Docelowym backendem aplikacji jest zarządzany Supabase SaaS:
PostgreSQL, Auth i Data API działają w projekcie Supabase, a przeglądarka łączy
się z nimi przy użyciu publicznego klucza chronionego przez RLS. Odseparowany
tryb demo pozostaje dostępny wyłącznie po jawnym włączeniu.

Rdzeń obejmuje szybki Capture i typowany triage Skrzynki, Projekty, Cele,
otwarte Działania, postęp, Rutyny, Knowledge (Note, Resource, Decision,
Artifact, Investigation), odwracalne Archive/Trash oraz weekly Review.
Focus i Checkpoint pozostają danymi historycznymi: można je otworzyć w trybie
read-only i wyeksportować, ale aktywny produkt nie tworzy nowych sesji.

Ekran `Podsumowanie tygodnia` zawiera opcjonalny, uruchamiany ręcznie Przegląd
Celów z AI. W trybie demo jest to deterministyczna symulacja, a w Supabase
bezpieczna funkcja Edge korzystająca z OpenAI-compatible NVIDIA API/NIM. Model
ma wyłącznie ograniczony kontekst aktywnych Celów i nie może wykonywać zmian.

## Uruchomienie z Supabase SaaS

Wymagania: Node.js 24 i pnpm 10. Nie jest potrzebny lokalny Docker ani lokalny
stos Supabase.

1. Utwórz zarządzany projekt Supabase i zastosuj migracje zgodnie z
   `docs/deployment/managed-supabase.md`.
2. Skopiuj `apps/web/.env.example` do `apps/web/.env.local`.
3. Wklej Project URL oraz **publishable key** z panelu Supabase.
4. Uruchom aplikację:

```bash
pnpm install
pnpm dev
```

Aplikacja jest domyślnie dostępna pod `http://localhost:5173`. Produkcyjny tryb
Supabase nie przechodzi po cichu na dane lokalne: brak lub niepoprawna
konfiguracja wyświetla błąd. Secret key i legacy `service_role` nie mogą być
umieszczone w zmiennych `VITE_*`.

## Migracje zarządzanego projektu

Schemat znajduje się w `supabase/migrations`. Zawiera izolację Workspace przez
RLS, bieżący model Project–Goal–Action, paginowane RPC z kursorem
`(sort_value, id)`, read-only dostęp do historycznego Focus oraz pełny eksport
historycznych tabel. Funkcje odczytu są `security invoker` i mają jawne
`REVOKE`/`GRANT EXECUTE TO authenticated`.

```bash
pnpm supabase:link --project-ref <project-ref>
pnpm supabase:migrations
pnpm supabase:plan
pnpm supabase:deploy
pnpm supabase:lint:remote
```

Po konfiguracji sekretów NVIDIA funkcję AI wdraża się osobno zgodnie z sekcją
„Przegląd AI” w `docs/deployment/managed-supabase.md`. Klucz NVIDIA ani secret
key Supabase nie mogą trafić do aplikacji webowej.

Pierwsze trzy komendy przed wdrożeniem są obowiązkową kontrolą. Produkcję można
wdrażać ręcznie przez workflow `Wdrożenie migracji Supabase`, po wcześniejszym
sprawdzeniu tych samych migracji na `staging`.

Frontend PWA można wdrażać automatycznie na Vercel po każdym pushu do `main`.
Konfigurację prywatnego, jednoosobowego wdrożenia opisuje
[`docs/deployment/vercel.md`](docs/deployment/vercel.md).

## Kontrole jakości

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
VITE_DATA_BACKEND=demo pnpm build
pnpm check:bundle
```

Suita obejmuje przepływy użytkownika, Store i jego rollbacki, uwierzytelnianie,
mapowanie repozytorium Supabase oraz migracje PostgreSQL z politykami RLS.
Testy bazy korzystają z izolowanego PostgreSQL/PGlite, więc nie zapisują niczego
w zarządzanym projekcie i nie wymagają pełnego lokalnego Supabase.

## Struktura

```text
apps/web/                 React + TypeScript + Vite PWA
  src/app/                routing i stan aplikacji
  src/components/         shell, komponenty produktowe i UI
  src/domain/             typy domenowe
  src/pages/              Start, Inbox, Projects, Goals, Knowledge, Review, history
supabase/
  migrations/             wersjonowany schemat PostgreSQL i RLS
  tests/                  izolowane testy migracji/RLS
docs/                     architektura, ADR-y, design system i instrukcja wdrożenia
```
