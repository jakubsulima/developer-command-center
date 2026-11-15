import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CaptureComposer } from "./CaptureComposer";
import { draftStorageKey } from "../hooks/usePersistentDraft";
import { OperationResponseError } from "../lib/operationFailure";
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ mode: "demo", user: { id: "capture-user" } }) }));
vi.mock("../app/useStore", () => ({ useStore: () => ({ state: { workspaceId: "capture-workspace" } }) }));
const key = draftStorageKey("capture-user", "capture-workspace", "creation:capture");
it("retries a restored URL with a description as text using the existing command", async () => {
  const content = "https://runrepeat.com/\nStrona z ocenami butów", commandId = crypto.randomUUID();
  localStorage.setItem(key, JSON.stringify({ version: 2, savedAt: "2026-11-15", value: { content, commandId, attempted: true } }));
  const user = userEvent.setup(), submit = vi.fn().mockResolvedValue(undefined), success = vi.fn();
  render(<CaptureComposer id="capture" draftKey="quick-capture" onSubmit={submit} onSuccess={success} />);
  await user.click(screen.getByRole("button", { name: "Ponów zapis" }));
  await waitFor(() => expect(success).toHaveBeenCalled());
  expect(submit).toHaveBeenCalledWith(content, "text", commandId);
  expect(localStorage.getItem(key)).toBeNull();
});
it("unlocks a rejected first attempt and gives the corrected content a new command", async () => {
  const user = userEvent.setup();
  const submit = vi.fn().mockRejectedValueOnce(new OperationResponseError("Capture: workspace_access_denied", "P0001")).mockResolvedValueOnce(undefined);
  render(<CaptureComposer id="capture" draftKey="quick-capture" onSubmit={submit} />);
  await user.type(screen.getByRole("textbox"), "Myśl");
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("odrzucony");
  expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly");
  await user.type(screen.getByRole("textbox"), " poprawiona");
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(submit.mock.calls[1][0]).toBe("Myśl poprawiona");
  expect(submit.mock.calls[1][2]).not.toBe(submit.mock.calls[0][2]);
});
it("keeps an uncertain earlier attempt locked even when a retry is rejected", async () => {
  const user = userEvent.setup();
  const submit = vi.fn().mockRejectedValueOnce(new Error("connection_lost")).mockRejectedValueOnce(new OperationResponseError("Capture: access denied", "42501"));
  render(<CaptureComposer id="capture" draftKey="quick-capture" onSubmit={submit} />);
  await user.type(screen.getByRole("textbox"), "Myśl");
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: "Ponów zapis" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Nie potwierdzono zapisu");
  expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  expect(submit.mock.calls[1]).toEqual(submit.mock.calls[0]);
});
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

it("keeps both the existing Capture and text brought from another creation type", async () => {
  localStorage.setItem(key, JSON.stringify({ version: 2, savedAt: "2026-11-03", value: { content: "Pierwsza myśl", commandId: "previous", attempted: false } }));
  const user = userEvent.setup();
  render(<CaptureComposer id="capture" draftKey="quick-capture" initialContent="Tekst przenoszony z Działania" onSubmit={vi.fn()} />);
  expect(screen.getByRole("textbox")).toHaveValue("Pierwsza myśl");
  await user.click(screen.getByText(/Inne szkice do odzyskania/));
  expect(screen.getByText("Tekst przenoszony z Działania")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Wznów szkic 1" }));
  expect(screen.getByRole("textbox")).toHaveValue("Tekst przenoszony z Działania");
  const preserved = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((item): item is string => Boolean(item?.startsWith(`${key}:recovery:`))).map((item) => JSON.parse(localStorage.getItem(item)!).value.content);
  expect(preserved).toContain("Pierwsza myśl");
});
