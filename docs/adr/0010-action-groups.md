# Kategorie i zadania nadrzędne jako grupy Działań

Status: Accepted, 2026-11-14. Zastępuje interpretację Goal jako obowiązkowego
rezultatu z ADR 0009; zachowuje pozostałe decyzje i historyczne dane.

## Decyzja

Grupa Działań ma odmianę `category` lub `task`. Kategoria, np. UI/UX albo
Wydajność, pozostaje otwarta na kolejne Działania. Nie wymaga rezultatu,
kryteriów sukcesu ani następnego kroku i nie ma daty docelowej lub statusu
ukończenia. Zadanie nadrzędne zamyka się jawnie; rezultat i kryteria są
opcjonalne. Ukończenie ostatniego Działania nie zamyka żadnej grupy.

Nowe formularze domyślnie wybierają kategorię. Działanie ma najwyżej jedną
grupę; może też należeć bezpośrednio do Projektu. W Projekcie pokazujemy
Działania pod nazwami ich grup i osobno „Bez grupy”.

## Zgodność i integralność

Tabela `goals`, identyfikatory `Goal` / `goalId` i adresy `/goals` pozostają.
Nowa kolumna `group_type` ma domyślną wartość `task`; starszy snapshot bez
`groupType` również oznacza zadanie. Migracja nie przepisuje opisów, dat,
statusów, kryteriów, postępu, materiałów, powiązań ani Rutyn.

Konwersja na kategorię jest dozwolona tylko dla aktywnego, widocznego zadania
bez daty docelowej, kryteriów i historii rezultatów lub dowodów. Nie usuwamy
tych danych, aby umożliwić konwersję. Kategorię można zmienić w zadanie.
Zmiana Projektu grupy nie może osierocić jawnych powiązań jej Działań i Rutyn.
Przeniesienie Działania zachowuje jego ID, opis i historię; usuwa wskazanie
„następne” poprzedniej grupy. Baza sprawdza zgodność Workspace'u i Projektu.

## Konsekwencje

Plan tygodnia, eksport kontekstu i przegląd AI rozróżniają obie odmiany.
AI nie ocenia kategorii jak rezultatu do osiągnięcia. Zachowane nazwy
techniczne ograniczają zakres migracji oraz utrzymują dawne linki i szkice.
Nie wdrażamy wielopoziomowego drzewa ani dwóch równoległych klasyfikacji.
Po utworzeniu kategorii wymagany jest klient rozumiejący nowy typ; wycofanie
nie polega na usuwaniu kolumn ani powiązanych danych.
