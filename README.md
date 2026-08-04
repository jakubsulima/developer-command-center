# Developer Command Center

Responsywna PWA prowadząca pracę i naukę przez pętlę:

`Capture → Shape → Commit → Focus → Checkpoint → Review`

Interfejs jest oparty na dokumentacji w `CONTEXT.md` oraz makietach w
`docs/design`. Docelowym backendem aplikacji jest zarządzany Supabase SaaS:
PostgreSQL, Auth i Data API działają w projekcie Supabase, a przeglądarka łączy
się z nimi przy użyciu publicznego klucza chronionego przez RLS. Odseparowany
tryb demo pozostaje dostępny wyłącznie po jawnym włączeniu.

Rdzeń obejmuje szybki Capture i typowany triage Inboxu, shaping projektu z
Outcome, pierwszym Work Itemem i opcjonalnym Effort Budgetem, WIP/Primary
Commitment, ciągłe Focus Sessions, edytowalny Context Checkpoint, promocję
Session Scratchpadu, Knowledge (Note, Resource, Decision, Artifact,
Investigation), odwracalne Archive/Trash, Learning Evidence i cykl Learning
Goal, historię daily/weekly Review oraz rozdzielone AI Proposal i AI Execution.

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
RLS, rejestr typowanych encji, rdzeń projektów i nauki, ciągłe Focus Sessions,
checkpointy, Review, AI Proposals/Executions i append-only Activity Events.
Komendy obejmujące kilka tabel są atomowymi RPC; Capture, tworzenie projektu i
Focus są zabezpieczone na ponowienie.

```bash
pnpm supabase:link --project-ref <project-ref>
pnpm supabase:migrations
pnpm supabase:plan
pnpm supabase:deploy
pnpm supabase:lint:remote
```

Pierwsze trzy komendy przed wdrożeniem są obowiązkową kontrolą. Produkcję można
wdrażać ręcznie przez workflow `Wdrożenie migracji Supabase`, po wcześniejszym
sprawdzeniu tych samych migracji na `staging`.

## Kontrole jakości

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
VITE_DATA_BACKEND=demo pnpm build
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
  src/pages/              Command, Focus, Inbox, Projects, Learning, Knowledge, Review
supabase/
  migrations/             wersjonowany schemat PostgreSQL i RLS
  tests/                  izolowane testy migracji/RLS
docs/                     architektura, ADR-y, design system i instrukcja wdrożenia
```
