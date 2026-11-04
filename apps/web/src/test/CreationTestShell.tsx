import { useEffect, useState, type ReactNode } from "react";
import { QuickAdd, type QuickAddRequest } from "../components/QuickAdd";

/** Keep page unit tests on the real shared creation form without AppShell navigation. */
export function CreationTestShell({ children, addAction }: { children: ReactNode; addAction?: { quickAdd?: QuickAddRequest } }) {
  const [request, setRequest] = useState<QuickAddRequest>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const receive = (event: Event) => { setRequest((event as CustomEvent<QuickAddRequest>).detail); setOpen(true); };
    window.addEventListener("app-shell:quick-add", receive);
    return () => window.removeEventListener("app-shell:quick-add", receive);
  }, []);
  return <>{addAction ? <button onClick={() => { setRequest(addAction.quickAdd); setOpen(true); }}>Dodaj test</button> : null}{children}{open ? <QuickAdd open request={request} onClose={() => setOpen(false)} /> : null}</>;
}
