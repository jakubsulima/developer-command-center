# Zarządzany Supabase: konfiguracja i wdrożenie

## Docelowy układ

- `staging`: integracja aplikacji, Auth i migracji przed produkcją;
- `production`: dane użytkowników, tylko zatwierdzone migracje;
- testy lokalne: PGlite/izolowany PostgreSQL, bez pełnego stosu Supabase i bez
  połączenia z danymi użytkowników.

Supabase Free pozwala obecnie na dwa aktywne projekty, więc ten układ mieści się
w limicie MVP. Free może jednak wstrzymać mało aktywny projekt i nie zapewnia
automatycznych backupów. Dla aplikacji, której niedostępność lub utrata danych
jest istotnym ryzykiem, `production` powinno korzystać z Pro.

## 1. Utworzenie projektów

1. W jednej organizacji utwórz dwa odrębne projekty: `command-staging` i
   `command-production`; wybierz najbliższy dostępny region UE.
2. Zapisz osobno Project Ref oraz hasło bazy każdego projektu. Project Ref jest
   częścią adresu panelu: `.../project/<project-ref>`.
3. W `Connect` lub `Settings → API Keys` utwórz/skopiuj nowy **publishable
   key** (`sb_publishable_…`). Nie używaj legacy `anon`, secret key ani
   `service_role` w aplikacji webowej.
4. W `Authentication → URL Configuration` ustaw dokładny produkcyjny Site URL.
   Dodaj `http://localhost:5173/**` i dokładne adresy staging/preview do Redirect
   URLs. Na produkcji preferuj konkretne adresy zamiast szerokiego wildcardu.

Dokumentacja platformy: [API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## 2. Pierwsze wdrożenie schematu

Zaloguj CLI, połącz repozytorium najpierw ze stagingiem i sprawdź plan:

```bash
pnpm --filter @command/web exec supabase login
pnpm supabase:link --project-ref <staging-project-ref>
pnpm supabase:migrations
pnpm supabase:plan
```

Jeżeli projekt jest pusty, plan powinien zawierać wyłącznie migracje z
`supabase/migrations`. Zastosuj je i uruchom lint połączonej bazy:

```bash
pnpm supabase:deploy
pnpm supabase:lint:remote
pnpm supabase:migrations
```

Nigdy nie używaj `--include-all` bez wcześniejszego wyjaśnienia rozbieżności.
Jeżeli projekt miał wcześniej zmiany wykonane w Dashboardzie, najpierw wykonaj
`supabase db pull` na osobnej gałęzi i przejrzyj wygenerowaną migrację.

Aktualny workflow CLI opisują [migracje](https://supabase.com/docs/guides/deployment/database-migrations)
i [zarządzanie środowiskami](https://supabase.com/docs/guides/deployment/managing-environments).

## 3. Konfiguracja aplikacji

W development skopiuj `apps/web/.env.example` do nieśledzonego
`apps/web/.env.local` i wpisz wartości projektu staging:

```text
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://<staging-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_ENABLE_DEMO_MODE=false
```

W hostingu ustaw te same nazwy z wartościami projektu produkcyjnego. Zmienne
`VITE_*` są wbudowywane w statyczny bundle podczas builda, więc po zmianie
trzeba wdrożyć frontend ponownie. Publishable key może być publiczny, ale
bezpieczeństwo danych musi zapewniać RLS. Żadna zmienna `VITE_*` nie może
zawierać `sb_secret_…` ani `service_role`.

## 4. GitHub Environments i migracje

Utwórz dwa GitHub Environments: `staging` oraz `production`. W każdym dodaj
sekrety o tych samych nazwach, ale z wartościami właściwego projektu:

- `SUPABASE_ACCESS_TOKEN` — personal access token dla CLI;
- `SUPABASE_PROJECT_ID` — Project Ref;
- `SUPABASE_DB_PASSWORD` — hasło bazy.

Workflow `.github/workflows/supabase-deploy.yml` jest uruchamiany ręcznie,
wyświetla historię, wykonuje dry-run, wdraża migracje i uruchamia zdalny lint.
Dla environment `production` skonfiguruj wymagane zatwierdzenie. Kolejność
wydania: migracja na `staging` → test aplikacji → zatwierdzenie → ta sama
migracja na `production`.

## 5. Kontrola bezpieczeństwa przed produkcją

- wszystkie tabele publicznego Data API mają włączone RLS;
- każda tabela ma jawne `GRANT` oraz polityki dla wymaganych operacji;
- polityki izolują rekordy przez `workspace_members` i `auth.uid()`;
- secret/service role działa wyłącznie w zaufanym backendzie, nigdy w PWA;
- Supabase Security Advisor nie ma niewyjaśnionych błędów;
- rejestracja tworzy Workspace przez kontrolowany trigger i została sprawdzona
  na stagingu z dwoma niezależnymi użytkownikami;
- Site URL, redirect URLs, rate limits i wysyłka e-maili Auth są skonfigurowane;
- przed publicznym użyciem istnieje sprawdzony eksport/backup i procedura
  odtworzenia.

Pełną listę produkcyjną utrzymuje Supabase w
[Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

## 6. Typy bazy

Po każdym wdrożeniu schematu wygeneruj typy z połączonego projektu i przejrzyj
diff przed commitem:

```bash
pnpm supabase:types > apps/web/src/lib/database.types.ts
```

Następny krok implementacyjny to podanie wygenerowanego `Database` jako typu
generycznego do `createClient`. Typy powinny być generowane po migracji staging,
nie ręcznie przepisywane.
