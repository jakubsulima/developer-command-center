import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { emptyState } from "../data/empty";
import { selectLocalContextData } from "../domain/aiContext";
import { AIContextExport } from "./AIContextExport";

const { loadContextData } = vi.hoisted(() => ({ loadContextData: vi.fn() }));
const state = structuredClone(emptyState);
state.areas = [{ id: "project", name: "Project", description: "Current context", visibility: "active", createdAt: "2026-10-01", updatedAt: "2026-10-02" }];
state.knowledge = [{ id: "source", type: "resource", title: "Reference", detail: "Source content" }];
state.knowledgeLinks = [{ id: "link", knowledgeItemId: "source", areaId: "project", meaning: "reference", createdAt: "2026-10-01" }];
vi.mock("../app/useStore", () => ({ useStore: () => ({ state, mode: "demo" }) }));
vi.mock("../data/aiContextRepository", () => ({ loadContextData }));

beforeEach(() => {
  loadContextData.mockReset().mockImplementation((_state, _mode, request) => Promise.resolve(selectLocalContextData(state, request)));
});
function renderExport() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AIContextExport target={{ type: "project", id: "project" }} /></QueryClientProvider>);
}
it("copies the exact preview without changing its timestamp and allows excluding individual sources", async () => {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  renderExport();
  await user.click(screen.getByRole("button", { name: "Przekaż kontekst do AI" }));
  await screen.findByText("Kompletny pakiet w wybranym zakresie.");
  await user.type(screen.getByLabelText("Co AI ma pomóc zrobić?"), "Help choose a step");
  await user.selectOptions(screen.getByLabelText("Format"), "json");
  const preview = screen.getByLabelText("Podgląd finalnej treści") as HTMLTextAreaElement;
  const before = preview.value;
  expect(JSON.parse(before).intent).toBe("Help choose a step");
  await user.click(screen.getByRole("button", { name: "Kopiuj" }));
  expect(copy).toHaveBeenCalledWith(before);
  await screen.findByText("Skopiowano pakiet.");
  expect(preview.value).toBe(before);
  await user.click(screen.getByText("Źródła pakietu (2)"));
  expect(screen.getByRole("checkbox", { name: /^Project$/ })).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: "Reference" }));
  expect(JSON.parse(preview.value).sources.map((source: { key: string }) => source.key)).toEqual(["project:project"]);
  copy.mockRestore();
});
it("offers retry for a failed fresh read and then builds the current package", async () => {
  loadContextData.mockRejectedValueOnce(new Error("Read unavailable"));
  const user = userEvent.setup();
  renderExport();
  await user.click(screen.getByRole("button", { name: "Przekaż kontekst do AI" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Read unavailable");
  expect(screen.queryByRole("button", { name: "Kopiuj" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
  await waitFor(() => expect((screen.getByLabelText("Podgląd finalnej treści") as HTMLTextAreaElement).value).toContain("Current context"));
});
