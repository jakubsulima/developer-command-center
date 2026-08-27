# Plan 06 — Pomiar i utrzymanie wydajności

## Rezultat

Aplikacja utrzymuje szybki start i interakcje na mobile, a kolejne funkcje nie
zużywają pozostałego budżetu bez pomiaru.

## Stan wyjściowy

Build przechodzi. Entry JS ma około 109,7 KB gzip przy limicie 122,9 KB, a CSS
32,4 KB przy limicie 35,8 KB. Startup metrics działają głównie dewelopersko.

## Zakres

1. Zmierzyć na buildzie produkcyjnym: start aplikacji, przejście na lazy route,
   otwarcie Quick Add i pierwszą interakcję po załadowaniu Workspace'u.
2. Wysyłać zagregowane timingi przez adapter monitoringu bez treści użytkownika.
3. Zidentyfikować nieużywane prymitywy UI i reguły CSS; usuwać tylko na podstawie
   wyszukiwania, testów i weryfikacji wizualnej.
4. Przenieść ciężkie, rzadkie fragmenty za granice lazy load, jeśli pomiar pokaże
   realną korzyść.
5. Utrzymać obecne limity bundle jako blokujące w CI.

## Kryteria akceptacji

- Istnieje powtarzalny raport przed/po dla desktopu i 390×844.
- Entry JS i CSS mają większy zapas niż przed zmianą albo udokumentowany brak
  bezpiecznej redukcji.
- Brak regresji offline shell, auth, routingu, fontów i modali.
- Nie dodano zewnętrznego skryptu analitycznego do ścieżki krytycznej.

## Weryfikacja

Production build, `pnpm check:bundle`, pełne quality gates oraz przeglądarkowy
smoke test najważniejszych tras.

