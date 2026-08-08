import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MultiCombobox } from "./MultiCombobox";

describe("MultiCombobox", () => {
  it("selects and removes multiple values with the keyboard", async () => {
    const user = userEvent.setup();
    function Harness() { const [value, setValue] = useState<string[]>([]); return <MultiCombobox label="Powiązane Cele" options={[{ id: "one", label: "Pierwszy Cel" }, { id: "two", label: "Drugi Cel" }]} value={value} onChange={setValue} />; }
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Powiązane Cele" });
    await user.click(input); await user.keyboard("{Enter}");
    expect(screen.getByText("Pierwszy Cel")).toBeInTheDocument();
    await user.click(input); await user.keyboard("{Enter}");
    expect(screen.getByText("Drugi Cel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usuń powiązanie: Pierwszy Cel" }));
    expect(screen.queryByRole("button", { name: "Usuń powiązanie: Pierwszy Cel" })).not.toBeInTheDocument();
  });
});
