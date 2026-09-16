import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("odsłania pole w przewijanej treści po zmianie obszaru widocznego nad klawiaturą", () => {
    vi.useFakeTimers();
    const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
    vi.stubGlobal("visualViewport", viewport);
    const { container, unmount } = render(<Modal open title="Dodaj" onClose={vi.fn()}><div data-modal-scroll-body><input aria-label="Nazwa" /></div></Modal>);
    const body = container.querySelector<HTMLElement>("[data-modal-scroll-body]")!;
    const field = container.querySelector("input")!;
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ top: 60, bottom: 280 } as DOMRect);
    vi.spyOn(field, "getBoundingClientRect").mockReturnValue({ top: 260, bottom: 304, height: 44 } as DOMRect);
    field.focus();
    act(() => { viewport.height = 360; viewport.offsetTop = 20; viewport.dispatchEvent(new Event("resize")); });
    act(() => vi.advanceTimersByTime(180));
    expect(container.querySelector(".modal-backdrop")).toHaveStyle({ "--modal-viewport-height": "360px", "--modal-viewport-offset-top": "20px" });
    expect(body.scrollTop).toBe(36);
    unmount();
    expect(document.body.style.position).not.toBe("fixed");
  });

  it("nie cofa ręcznego przewijania podczas przesuwania visual viewport", () => {
    vi.useFakeTimers();
    const viewport = Object.assign(new EventTarget(), { height: 360, offsetTop: 0 });
    vi.stubGlobal("visualViewport", viewport);
    const { container, unmount } = render(<Modal open title="Dodaj" onClose={vi.fn()}><div data-modal-scroll-body><input aria-label="Nazwa" /></div></Modal>);
    const body = container.querySelector<HTMLElement>("[data-modal-scroll-body]")!;
    const field = container.querySelector("input")!;
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ top: 60, bottom: 280 } as DOMRect);
    vi.spyOn(field, "getBoundingClientRect").mockReturnValue({ top: 260, bottom: 304, height: 44 } as DOMRect);
    field.focus();
    act(() => vi.advanceTimersByTime(180));
    body.scrollTop = 100;
    act(() => { viewport.offsetTop = 40; viewport.dispatchEvent(new Event("scroll")); });
    act(() => vi.advanceTimersByTime(180));
    expect(body.scrollTop).toBe(100);
    expect(document.documentElement.style.overflow).toBe("hidden");
    unmount();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("odsłania kolejne pole bez zmiany wysokości klawiatury", () => {
    vi.useFakeTimers();
    const { container, unmount } = render(<Modal open title="Dodaj" onClose={vi.fn()}><div data-modal-scroll-body><input /><input /></div></Modal>);
    act(() => vi.advanceTimersByTime(180));
    const body = container.querySelector<HTMLElement>("[data-modal-scroll-body]")!;
    const field = container.querySelectorAll("input")[1]!;
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ top: 60, bottom: 280 } as DOMRect);
    vi.spyOn(field, "getBoundingClientRect").mockReturnValue({ top: 260, bottom: 304, height: 44 } as DOMRect);
    field.focus();
    act(() => vi.advanceTimersByTime(180));
    expect(body.scrollTop).toBe(36);
    unmount();
  });

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
