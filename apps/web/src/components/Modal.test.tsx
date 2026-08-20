import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  afterEach(() => vi.useRealTimers());

  it("pozostaje zamontowany na czas animacji zamykania", () => {
    vi.useFakeTimers();
    const props = { title: "Test", onClose: vi.fn(), exitDurationMs: 160 };
    const { container, rerender } = render(<Modal open {...props}><p>Treść</p></Modal>);

    rerender(<Modal open={false} {...props}><p>Treść</p></Modal>);

    const closingBackdrop = container.querySelector(".modal-backdrop");
    expect(closingBackdrop).toHaveClass("modal-backdrop-closing");
    expect(closingBackdrop).toHaveAttribute("aria-hidden", "true");

    act(() => vi.advanceTimersByTime(160));
    expect(container.querySelector(".modal-backdrop")).not.toBeInTheDocument();
  });
});
