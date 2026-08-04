# Offline obejmuje Capture i Focus, nie całą domenę

MVP pozwala offline odczytać ostatni Command oraz wykonywać Capture, Focus
Session, Context Checkpoint i Session Scratchpad. Triage, shaping, Commitments,
Review, AI i integracje wymagają połączenia. Lokalne komendy są idempotentne, a
konflikty wymagają decyzji zamiast last-write-wins; ograniczamy w ten sposób
ryzyko synchronizacji kosztem niepełnej edycji offline.
