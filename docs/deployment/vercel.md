# Vercel + Supabase: prywatne wdrożenie PWA

## Architektura

- Vercel hostuje statyczny frontend PWA i automatycznie wdraża `main`.
- Supabase pozostaje backendem: Auth, PostgreSQL, Data API i RLS.
- Publiczny adres aplikacji nie oznacza publicznych danych. Dostęp do danych
  wymaga sesji Supabase i przejścia polityk RLS.

## 1. Prywatny użytkownik w Supabase

1. Zastosuj migracje zgodnie z `managed-supabase.md`.
2. W Supabase Dashboard utwórz własnego użytkownika w `Authentication → Users`.
   Trigger migracji automatycznie utworzy dla niego prywatny Workspace.
3. Wyłącz `Allow new users to sign up` w konfiguracji Auth. Pozostaw wyłączone
   anonymous sign-ins. Istniejący użytkownik nadal może się logować.
4. Włącz potwierdzanie adresu e-mail i MFA dla konta administrującego Supabase.
5. Uruchom Security Advisor i nie wdrażaj z niewyjaśnionymi błędami RLS.

`VITE_ENABLE_SIGNUP=false` ukrywa formularz rejestracji, ale nie jest kontrolą
bezpieczeństwa. Rejestrację blokuje ustawienie serwera Auth w Supabase.

## 2. Projekt Vercel

Zaimportuj repozytorium GitHub jako nowy projekt i ustaw:

- Root Directory: `apps/web`
- Framework Preset: `Vite`
- Build Command: `pnpm build`
- Output Directory: `dist`

W środowisku `Production` dodaj:

```text
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_ENABLE_DEMO_MODE=false
VITE_ENABLE_SIGNUP=false
```

Nie umieszczaj w Vercel `service_role`, `sb_secret_...` ani hasła bazy. Frontend
potrzebuje wyłącznie publicznego URL i publishable key.

`vercel.json` zapewnia fallback tras SPA oraz nagłówki bezpieczeństwa. Po
połączeniu repo każde wypchnięcie do `main` tworzy automatyczny deployment
produkcyjny. Preview deployments warto kierować do oddzielnego projektu
Supabase staging; nie należy testować migracji i eksperymentalnego kodu na
danych produkcyjnych.

## 3. Auth URL i test telefonu

Po pierwszym wdrożeniu skopiuj produkcyjny adres `https://...vercel.app` do
Supabase `Authentication → URL Configuration → Site URL`. Dodaj dokładny adres
do Redirect URLs, jeśli później pojawią się magic links, reset hasła lub OAuth.

Na telefonie otwórz adres po HTTPS, zaloguj się i użyj opcji przeglądarki
„Dodaj do ekranu głównego”. Sprawdź co najmniej: odświeżenie zagnieżdżonej trasy,
ponowne otwarcie PWA, zapis danych, wylogowanie oraz brak możliwości rejestracji.
