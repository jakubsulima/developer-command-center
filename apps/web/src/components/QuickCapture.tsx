import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { CaptureComposer } from "./CaptureComposer";
import { useActionFeedback } from "./action-feedback-context";
import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from "react";
import { useAuth } from "../auth/useAuth";
import { draftStorageKey } from "../hooks/usePersistentDraft";
import { requestAppQuickAdd } from "./appQuickAddRequest";
import type { InboxItem } from "../domain/types";
import { Button } from "./ui";

const PreviousQuickAdd = lazy(() => import("./QuickAdd").then(module => ({ default: module.QuickAdd })));

export function QuickCapture({ onClose, closeGuard, onSavingChange }: { onClose?: () => void; closeGuard?: RefObject<(() => boolean) | null>; onSavingChange?: (saving: boolean) => void }) {
  const { capture, undoCapture, state } = useStore();
  const { user } = useAuth();
  const [hasPreviousDraft] = useState(() => {
    if (!user) return false;
    try {
      const workspace = state.workspaceId ?? "demo-workspace";
      const raw = localStorage.getItem(draftStorageKey(user.id, workspace, "global-quick-add", "new")) ?? localStorage.getItem(draftStorageKey(user.id, workspace, "global-quick-add")) ?? localStorage.getItem(`command-center-draft-v1:${user.id}:${workspace}:global-quick-add`);
      const value = raw ? JSON.parse(raw).value : undefined;
      return Boolean(value && [value.title, value.content, value.detail].some((text) => typeof text === "string" && text.trim()));
    } catch { return false; }
  });
  const { notifyUndo } = useActionFeedback();
  const navigate = useNavigate();
  const [previousOpen, setPreviousOpen] = useState(false);
  const undoLock = useRef(false);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState("");
  const [receipt, setReceipt] = useState<InboxItem>();
  const receiptRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (receipt) receiptRef.current?.focus(); }, [receipt]);
  const address = (item: InboxItem) => `/knowledge?section=inbox&status=${item.status}&item=${item.id}`;
  return <>
    {previousOpen ? <Suspense fallback={<p role="status">Otwieranie szkicu…</p>}><PreviousQuickAdd open onClose={() => setPreviousOpen(false)} /></Suspense> : null}
    {hasPreviousDraft && !receipt ? <p>Masz wcześniejszy szkic. <Button variant="ghost" onClick={() => { if (closeGuard?.current && !closeGuard.current()) return; if (onClose) { onClose(); requestAppQuickAdd(); } else setPreviousOpen(true); }}>Otwórz poprzedni formularz</Button></p> : null}
    {!receipt && <CaptureComposer id="quick-capture-content" draftKey="quick-capture" closeGuard={closeGuard} onSavingChange={onSavingChange} onSubmit={capture} onClose={onClose} onSuccess={(item) => {
      if (!item) return;
      if (!onClose) { setUndoError(""); setReceipt(item); return; }
      notifyUndo({ event: "saved", message: "Zapisano w Skrzynce.", undo: () => undoCapture(item.id), action: { label: "Otwórz", onClick: () => navigate(address(item)) } });
      onClose?.();
    }} />}
    {receipt && <div className="capture-receipt">
      <p role="status" tabIndex={-1} ref={receiptRef}>Zapisano w Skrzynce.</p>
      <Link className="button button-secondary" to={address(receipt)}>Otwórz zapis</Link>
      <Button variant="primary" disabled={undoing} onClick={() => {
        setReceipt(undefined);
        requestAnimationFrame(() => document.getElementById("quick-capture-content")?.focus());
      }}>Zapisz kolejną myśl</Button>
      <Button variant="ghost" loading={undoing} onClick={async () => {
        if (undoLock.current) return;
        undoLock.current = true;
        setUndoing(true);
        setUndoError("");
        try {
          await undoCapture(receipt.id);
          setReceipt(undefined);
          requestAnimationFrame(() => document.getElementById("quick-capture-content")?.focus());
        } catch {
          setUndoError("Nie udało się cofnąć zapisu. Spróbuj ponownie.");
        } finally {
          undoLock.current = false;
          setUndoing(false);
        }
      }}>Cofnij zapis</Button>
      {undoError && <p role="alert">{undoError}</p>}
    </div>}
  </>;
}
