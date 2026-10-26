import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { CaptureComposer } from "./CaptureComposer";
import { useActionFeedback } from "./action-feedback-context";
import { lazy, Suspense, useState, type RefObject } from "react";
import { useAuth } from "../auth/useAuth";
import { draftStorageKey } from "../hooks/usePersistentDraft";
import { requestAppQuickAdd } from "./appQuickAddRequest";
import type { InboxItem } from "../domain/types";
import { Button } from "./ui";

const PreviousQuickAdd = lazy(() => import("./QuickAdd").then(module => ({ default: module.QuickAdd })));

export function QuickCapture({ onClose, closeGuard }: { onClose?: () => void; closeGuard?: RefObject<(() => boolean) | null> }) {
  const { capture, undoCapture, state } = useStore();
  const { user } = useAuth();
  const [hasPreviousDraft] = useState(() => {
    if (!user) return false;
    try {
      const workspace = state.workspaceId ?? "demo-workspace";
      const raw = localStorage.getItem(draftStorageKey(user.id, workspace, "global-quick-add")) ?? localStorage.getItem(`command-center-draft-v1:${user.id}:${workspace}:global-quick-add`);
      const value = raw ? JSON.parse(raw).value : undefined;
      return Boolean(value && [value.title, value.content, value.detail].some((text) => typeof text === "string" && text.trim()));
    } catch { return false; }
  });
  const { notifyUndo } = useActionFeedback();
  const navigate = useNavigate();
  const [previousOpen, setPreviousOpen] = useState(false);
  const [receipt, setReceipt] = useState<InboxItem>();
  const address = (item: InboxItem) => `/knowledge?section=inbox&status=${item.status}&item=${item.id}`;
  return <>
    {previousOpen ? <Suspense fallback={<p role="status">Otwieranie szkicu…</p>}><PreviousQuickAdd open onClose={() => setPreviousOpen(false)} /></Suspense> : null}
    {hasPreviousDraft ? <p>Masz wcześniejszy szkic. <Button variant="ghost" onClick={() => { if (closeGuard?.current && !closeGuard.current()) return; if (onClose) { onClose(); requestAppQuickAdd(); } else setPreviousOpen(true); }}>Otwórz poprzedni formularz</Button></p> : null}
    <CaptureComposer id="quick-capture-content" draftKey="quick-capture" closeGuard={closeGuard} onSubmit={capture} onClose={onClose} onSuccess={(item) => {
      if (!item) return;
      setReceipt(item);
      notifyUndo({ message: "Zapisano w Skrzynce.", undo: () => undoCapture(item.id), action: { label: "Otwórz", onClick: () => navigate(address(item)) } });
      onClose?.();
    }} />
    {receipt && !onClose ? <div className="capture-receipt"><Link to={address(receipt)}>Otwórz zapis</Link><Link to={`${address(receipt)}&organize=true`}>Uporządkuj</Link><Button variant="ghost" onClick={() => { setReceipt(undefined); document.getElementById("quick-capture-content")?.focus(); }}>Zapisz kolejną myśl</Button></div> : null}
  </>;
}
