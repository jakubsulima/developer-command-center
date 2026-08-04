import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AlertDialog } from "./AlertDialog";

function Harness({ confirm = vi.fn(), error }: { confirm?: () => Promise<void> | void; error?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try { await confirm(); } finally { setLoading(false); }
  };
  return <>
    <button onClick={() => setOpen(true)}>Usuń projekt</button>
    <AlertDialog open={open} title="Przenieść Project do Trash?" objectName="FinTrack API" consequence="Project zniknie z aktywnych widoków." preserved="Outcome i Work Items pozostaną." recovery="Możesz przywrócić go z Trash." confirmLabel="Przenieś do Trash" loading={loading} error={error} onCancel={() => setOpen(false)} onConfirm={run} />
  </>;
}

describe("AlertDialog", () => {
  it("opisuje skutek, bezpiecznie anuluje i przywraca fokus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Usuń projekt" });
    await user.click(opener);
    const dialog = screen.getByRole("alertdialog", { name: "Przenieść Project do Trash?" });
    expect(dialog).toHaveTextContent("FinTrack API");
    expect(dialog).toHaveTextContent("Outcome i Work Items pozostaną.");
    expect(dialog).toHaveTextContent("Możesz przywrócić go z Trash.");
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("blokuje zamknięcie i podwójne wykonanie podczas loading", async () => {
    let finish: (() => void) | undefined;
    const confirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<Harness confirm={confirm} />);
    await user.click(screen.getByRole("button", { name: "Usuń projekt" }));
    const destructive = screen.getByRole("button", { name: "Przenieś do Trash" });
    await user.dblClick(destructive);
    expect(confirm).toHaveBeenCalledOnce();
    expect(destructive).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    finish?.();
    await waitFor(() => expect(destructive).not.toBeDisabled());
  });

  it("pokazuje błąd bez zamykania dialogu", async () => {
    const user = userEvent.setup();
    render(<Harness error="Nie udało się wykonać komendy." />);
    await user.click(screen.getByRole("button", { name: "Usuń projekt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Nie udało się wykonać komendy.");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
