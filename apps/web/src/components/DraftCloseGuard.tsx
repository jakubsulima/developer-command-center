import { useState } from "react";
import type { DraftSaveStatus } from "../hooks/usePersistentDraft";
import { AlertDialog } from "./AlertDialog";

export function useDraftCloseGuard({ dirty, status, formName, discard, onClose, copyText }: { dirty: boolean; status: DraftSaveStatus; formName: string; discard: () => void; onClose: () => void; copyText?: string }) {
  const [open, setOpen] = useState(false);
  const requestClose = () => {
    if (dirty && status === "error") setOpen(true);
    else onClose();
  };
  const discardAndClose = () => {
    discard();
    setOpen(false);
    onClose();
  };
  const copy = async () => {
    if (!copyText || !navigator.clipboard) return;
    await navigator.clipboard.writeText(copyText);
  };
  return {
    requestClose,
    dialog: <AlertDialog open={open} title="Opuścić niezapisany przepływ?" objectName={formName} consequence="Szkic pozostanie na tym urządzeniu. Jeśli go odrzucisz, wpisana treść zostanie usunięta bez zmiany danych przestrzeni pracy." preserved="Wcześniej zapisane dane przestrzeni pracy pozostaną bez zmian." recovery="Wybierz Anuluj, skopiuj treść lub odrzuć szkic przed zamknięciem." confirmLabel="Odrzuć i zamknij" onCancel={() => setOpen(false)} onConfirm={discardAndClose} extraAction={copyText ? { label: "Kopiuj treść", onClick: copy } : undefined} />
  };
}
