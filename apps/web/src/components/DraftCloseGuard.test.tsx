import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDraftCloseGuard } from "./DraftCloseGuard";

function Harness({ discard, close }: { discard: () => void; close: () => void }) {
  const [modalOpen, setModalOpen] = useState(true);
  const guard = useDraftCloseGuard({ dirty: true, status: "error", formName: "Context Checkpoint", discard, onClose: () => { setModalOpen(false); close(); } });
  return <>{modalOpen && <button onClick={guard.requestClose}>Zamknij formularz</button>}{guard.dialog}</>;
}

describe("useDraftCloseGuard", () => {
  it("chroni treść, której nie udało się zapisać, do jawnego odrzucenia", async () => {
    const discard = vi.fn();
    const close = vi.fn();
    const user = userEvent.setup();
    render(<Harness discard={discard} close={close} />);
    await user.click(screen.getByRole("button", { name: "Zamknij formularz" }));
    const dialog = screen.getByRole("alertdialog", { name: "Opuścić niezapisany przepływ?" });
    expect(dialog).toHaveTextContent("Context Checkpoint");
    expect(close).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Anuluj" }));
    expect(discard).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Zamknij formularz" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Odrzuć i zamknij" }));
    expect(discard).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
