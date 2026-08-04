# Zarządzany Supabase jest backendem runtime

Środowiska `staging` i `production` korzystają z projektów Supabase SaaS, a nie
z samodzielnie utrzymywanego ani lokalnego pełnego stosu Supabase. Migracje,
testy SQL i konfiguracja klienta pozostają w repozytorium; testy używają
izolowanego PostgreSQL/PGlite, a integracja jest sprawdzana najpierw na
zarządzanym `staging`.

Ograniczamy w ten sposób utrzymanie Auth, PostgREST, backupów, aktualizacji i
monitoringu przez jedną osobę. Ceną jest zależność od dostępności i limitów
platformy oraz konieczność świadomego planu eksportu. Free może wystarczyć na
MVP, ale nie gwarantuje ciągłej dostępności ani automatycznych backupów, więc
publiczny produkt wymagający niezawodności powinien przejść na płatny plan.

Pełny lokalny Supabase pozostaje opcjonalnym narzędziem diagnostycznym, a nie
wymaganiem codziennego developmentu. Tryb demo nie jest awaryjnym backendem
produkcji i musi być jawnie włączony.
