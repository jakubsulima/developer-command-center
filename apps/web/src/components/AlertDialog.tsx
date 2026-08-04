import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./ui";

interface AlertDialogProps {
  open: boolean;
  title: string;
  objectName: string;
  consequence: string;
  preserved: string;
  recovery: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
  confirmDisabled?: boolean;
  error?: string;
  children?: ReactNode;
}

export function AlertDialog({ open, title, objectName, consequence, preserved, recovery, confirmLabel, onCancel, onConfirm, loading = false, confirmDisabled = false, error, children }: AlertDialogProps) {
  const confirmInFlight = useRef(false);
  useEffect(() => {
    if (!open) confirmInFlight.current = false;
  }, [open]);
  const confirm = async () => {
    if (confirmInFlight.current || loading || confirmDisabled) return;
    confirmInFlight.current = true;
    try {
      await onConfirm();
    } finally {
      confirmInFlight.current = false;
    }
  };
  return (
    <Modal open={open} title={title} onClose={onCancel} role="alertdialog" closeOnBackdrop={!loading} closeDisabled={loading}>
      <div className="alert-dialog-summary"><AlertTriangle /><span><strong>{objectName}</strong><p>{consequence}</p></span></div>
      <dl className="alert-dialog-details"><div><dt>Zachowane dane</dt><dd>{preserved}</dd></div><div><dt>Odzyskanie</dt><dd>{recovery}</dd></div></dl>
      {children}
      {error && <p className="auth-message error" role="alert">{error}</p>}
      <div className="modal-actions"><Button autoFocus disabled={loading} onClick={onCancel}>Anuluj</Button><Button variant="danger" loading={loading} disabled={confirmDisabled} onClick={() => void confirm()}>{confirmLabel}</Button></div>
    </Modal>
  );
}
