# Activity Events nie są event sourcingiem

Activity Events tworzą niezmienny audit udanych komend i timeline obiektów, ale
nie są źródłem prawdy ani mechanizmem odbudowy stanu. Aktualny stan pozostaje w
tabelach domenowych, undo używa komendy kompensującej, a logi błędów i analityka
produktowa są osobne. Zyskujemy wyjaśnialną historię bez kosztu pełnego event
sourcingu.
