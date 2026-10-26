import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CaptureComposer } from "./CaptureComposer";
import { draftStorageKey } from "../hooks/usePersistentDraft";
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ mode: "demo", user: { id: "capture-user" } }) }));
vi.mock("../app/useStore", () => ({ useStore: () => ({ state: { workspaceId: "capture-workspace" } }) }));
const key = draftStorageKey("capture-user", "capture-workspace", "quick-capture");
it("restores a failed attempt and retries the same payload and command after reopening", async () => {
  const user = userEvent.setup();
  const submit = vi.fn().mockRejectedValueOnce(new Error("connection_lost")).mockResolvedValueOnce({ id: "server-receipt" });
  const first = render(<CaptureComposer id="capture" draftKey="quick-capture" onSubmit={submit} />);
  await user.type(screen.getByRole("textbox"), "https://example.com/test");
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Nie potwierdzono zapisu");
  expect(JSON.parse(localStorage.getItem(key)!).value.attempted).toBe(true);
  const command = submit.mock.calls[0][2];
  first.unmount();
  const success = vi.fn();
  render(<CaptureComposer id="capture" draftKey="quick-capture" onSubmit={submit} onSuccess={success} />);
  expect(screen.getByRole("textbox")).toHaveValue("https://example.com/test");
  expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  await user.click(screen.getByRole("button", { name: "Ponów zapis" }));
  await waitFor(() => expect(success).toHaveBeenCalledWith({ id: "server-receipt" }));
  expect(submit.mock.calls[1]).toEqual(["https://example.com/test", "link", command]);
  expect(localStorage.getItem(key)).toBeNull();
  expect(screen.getByRole("textbox")).toHaveValue("");
});
it("keeps unsent text across closing and does not send when persisting the draft fails", async () => {
  const user = userEvent.setup(), submit = vi.fn();
  const first = render(<CaptureComposer id="capture" draftKey="quick-capture" onSubmit={submit} />);
  await user.type(screen.getByRole("textbox"), "Myśl bez klasyfikacji");
  first.unmount();
  render(<CaptureComposer id="capture" draftKey="quick-capture" onSubmit={submit} />);
  expect(screen.getByRole("textbox")).toHaveValue("Myśl bez klasyfikacji");
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  try {
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly");
  } finally { storage.mockRestore(); }
});
it("retains a different payload after a cross-tab key conflict and creates a new attempt", async () => {
  const user = userEvent.setup();
  const submit = vi.fn().mockRejectedValueOnce(new Error("Capture: capture_payload_conflict")).mockResolvedValueOnce(undefined);
  render(<CaptureComposer id="capture" draftKey="quick-capture" onSubmit={submit} />);
  await user.type(screen.getByRole("textbox"), "Different text in second tab");
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("innym oknie");
  expect(screen.getByRole("textbox")).toHaveValue("Different text in second tab");
  expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly");
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(submit.mock.calls[0][2]).not.toBe(submit.mock.calls[1][2]);
});
