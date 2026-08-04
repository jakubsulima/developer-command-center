# Approval AI jest oddzielone od wykonania

AI Proposal opisuje wygasającą, typowaną komendę z preview diffu, ale jej
zatwierdzenie nie oznacza zapisu. Approval tworzy osobną AI Execution, która
ponownie sprawdza autoryzację, wersje i zakres przed użyciem zwykłego application
service. Zyskujemy możliwość audytu i ochronę przed nieaktualnymi propozycjami
kosztem dodatkowego stanu oraz opóźnienia każdej operacji AI.
