import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MultiCombobox } from "./MultiCombobox";

describe("MultiCombobox", () => {
  it("selects and removes multiple values with the keyboard", async () => {
    const user = userEvent.setup();
    function Harness() { const [value, setValue] = useState<string[]>([]); return <MultiCombobox label="Powiązane Grupy działań" options={[{ id: "one", label: "Pierwszy Grupa działań" }, { id: "two", label: "Drugi Grupa działań" }]} value={value} onChange={setValue} />; }
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Powiązane Grupy działań" });
    await user.click(input); await user.keyboard("{Enter}");
    expect(screen.getByText("Pierwszy Grupa działań")).toBeInTheDocument();
    await user.click(input); await user.keyboard("{Enter}");
    expect(screen.getByText("Drugi Grupa działań")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usuń powiązanie: Pierwszy Grupa działań" }));
    expect(screen.queryByRole("button", { name: "Usuń powiązanie: Pierwszy Grupa działań" })).not.toBeInTheDocument();
  });
});
