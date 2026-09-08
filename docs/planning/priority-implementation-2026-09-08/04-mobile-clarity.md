# 04 — Czytelne Działania i lżejszy szczegół Celu

Zakres: U01–U03. Zależności: 02, 03. Obowiązują [zasady wspólne](./README.md).

## Rezultat i punkty wejścia

Na telefonie użytkownik rozpoznaje kontekst Działania i może je ukończyć lub zapisać postęp bez przekopywania się przez karty. Zachowaj aktualną ciemną paletę, Start i szybkie dodawanie z focusem.

Przeczytaj `pages/StartPage.tsx`, `pages/GoalDetailPage.tsx`, `components/ActionPrimaryControls.tsx`, `components/ActionKnowledgeRelations.tsx`, `components/ContextNavigation.tsx`, `components/Modal.tsx`, `components/ui.tsx`, `styles.css`. CSS może mieć zastane zmiany — analizuj bieżące selektory, nie przywracaj starej wersji pliku.

## Zakres i decyzje wizualne

1. Na mobilnym Starcie pozostaw jedną linię kontekstu Celu/Projektu przy każdym Działaniu. Użyj istniejącego resolvera kontekstu; dla samodzielnego kroku krótka etykieta „Samodzielne”. Bez pełnej listy relacji Wiedzy. Dwa identyczne tytuły z różnymi Celami mają widoczne rozróżnienie.
2. Pozostaw Na dziś w pierwszym ekranie dla dotychczasowego scenariusza demo 390×844. Przy dłuższych realnych treściach czytelność ma pierwszeństwo przed sztucznym przycięciem wszystkich opisów.
3. W szczególe Celu zredukuj poziomy obramowań wokół następnego Działania. Jeden dominujący nagłówek, nazwa kroku, krótki opis i kontrolki. Usuń powtarzające się instrukcje, nie samą funkcję.
4. Puste „Wiedza · 0” zastąp dyskretnym „Dodaj materiał”; dla istniejących relacji pokaż licznik z rozwinięciem. Zachowaj wszystkie możliwości edycji relacji i nawigację kontekstową.
5. Szybki wpis postępu ma widoczną etykietę, pole i jednoznaczne „Zapisz postęp”. Uwzględnij komunikaty draftu z 03. Przycisk musi dać się odsłonić przewijaniem przy otwartej klawiaturze; żaden sticky element nie zasłania pola, błędu lub zapisu.
6. Przejrzyj także Quick Add, modal wyszukiwarki i podstawowe filtry/listy: czytelny fokus, nazwy ikon, stany błędu, treści 10–12 px. Przyjmij cel projektu: ważny tekst pomocniczy co najmniej 13 px, główne kontrolki dotykowe co najmniej 44×44 CSS px (obszar aktywny może być większy niż ikona).
7. Zmierz kontrast tekstów i elementów interaktywnych na rzeczywistych tłach; jako cel odbioru przyjmij 4,5:1 dla zwykłego tekstu i 3:1 dla dużego tekstu oraz istotnych granic/stanu kontrolek. Nie traktuj samego pomiaru jako certyfikacji dostępności całej aplikacji.
8. Zachowaj obsługę klawiatury, czytnika, reduced motion i 200% zoom. Nie dodawaj nowego systemu komponentów, fontów ani globalnego redesignu.

## Odbiór

- [ ] Dwa identycznie nazwane Działania z różnych Celów rozróżnialne bez otwierania.
- [ ] Brak poziomego przewijania strony na 320/390/430 px, długie tytuły zawijają się sensownie.
- [ ] Następny krok i ukończenie pozostają na górze szczegółu; Wiedzę można dodać również przy zerowej liczbie relacji.
- [ ] Postęp można zapisać, poprawić po błędzie i odzyskać po wyjściu; fokus nie znika za dolną nawigacją.
- [ ] Zoom, klawiatura i etykiety dostępności działają; raport zawiera pomiary kontrastu i konkretne ekrany przed/po.
- [ ] Desktop zachowuje czytelną hierarchię i nie traci działań ani metadanych.

Sprawdź rzeczywisty telefon, jeśli dostępny; emulacja viewportu nie dowodzi poprawności klawiatury ekranowej. Brak urządzenia wpisz do raportu 04 jako otwarty punkt planu 09. Testuj zachowania, nie dokładną liczbę wrapperów CSS. Kontrole według README.

## Polecenie do wklejenia

```text
Zaimplementuj plan /Users/jakub/Documents/project-learning-app/docs/planning/priority-implementation-2026-09-08/04-mobile-clarity.md zgodnie z README. Uwzględnij rezultaty planów 02 i 03, zachowaj cudze zmiany CSS, zweryfikuj desktop/mobile i zapisz raport 04 z porównaniem wyglądu oraz ograniczeniami weryfikacji.
```
