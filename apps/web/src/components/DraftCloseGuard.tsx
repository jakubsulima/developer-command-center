import { useState } from "react";
import type { DraftSaveStatus } from "../hooks/usePersistentDraft";
import { AlertDialog } from "./AlertDialog";

export function useDraftCloseGuard({ dirty, status, formName, discard, onClose }: { dirty: boolean; status: DraftSaveStatus; formName: string; discard: () => void; onClose: () => void }) {
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
  return {
    requestClose,
    dialog: <AlertDialog open={open} title="Opuścić niezapisany przepływ?" objectName={formName} consequence="Wersji roboczej nie udało się zachować. Zamknięcie usunie wpisaną treść z tego urządzenia." preserved="Wcześniej zapisane dane przestrzeni pracy pozostaną bez zmian." recovery="Wybierz Anuluj, skopiuj treść lub ponów zapis przed zamknięciem." confirmLabel="Odrzuć i zamknij" onCancel={() => setOpen(false)} onConfirm={discardAndClose} />
  };
}
