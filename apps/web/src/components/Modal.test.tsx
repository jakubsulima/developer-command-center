import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("wyświetla okno poza kontenerem strony, który może przycinać jego zawartość", () => {
    const { container, unmount } = render(<main style={{ overflow: "hidden", transform: "translateY(-200px)" }}><Modal open title="Zmień status" onClose={vi.fn()}><button>W toku</button></Modal></main>);
    const backdrop = document.querySelector("[data-modal-backdrop]")!;
    expect(backdrop.parentElement).toBe(document.body);
    expect(container.contains(backdrop)).toBe(false);
    expect(container.inert).toBe(true);
    unmount();
    expect(container.inert).not.toBe(true);
  });

  it("zapamiętuje przewinięcie przed zmianą overflow i odtwarza je po zamknięciu", () => {
    const position = vi.spyOn(window, "scrollY", "get").mockImplementation(() => document.documentElement.style.overflow === "hidden" ? 0 : 640);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    try {
      const { unmount } = render(<Modal open title="Dodaj" onClose={vi.fn()}><input /></Modal>);
      expect(document.body.style.top).toBe("-640px");
      position.mockReturnValue(0);
      unmount();
      expect(document.body.style.position).not.toBe("fixed");
      expect(scrollTo).toHaveBeenCalledWith(0, 640);
    } finally {
      position.mockRestore();
      scrollTo.mockRestore();
    }
  });

  it("blokuje tło również przy otwieraniu wcześniej zamkniętego panelu", () => {
    const props = { title: "Szybki zapis", onClose: vi.fn(), exitDurationMs: 160 };
    const { container, rerender } = render(<Modal open={false} {...props}><input /></Modal>);
    rerender(<Modal open {...props}><input /></Modal>);
    expect(document.querySelector("[data-modal-backdrop]")?.parentElement).toBe(document.body);
    expect(container.inert).toBe(true);
  });

  it("odsłania pole w przewijanej treści po zmianie obszaru widocznego nad klawiaturą", () => {
    vi.useFakeTimers();
    const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
    vi.stubGlobal("visualViewport", viewport);
    const { baseElement, unmount } = render(<Modal open title="Dodaj" onClose={vi.fn()}><div data-modal-scroll-body><input aria-label="Nazwa" /></div></Modal>);
    const body = baseElement.querySelector<HTMLElement>("[data-modal-scroll-body]")!;
    const field = baseElement.querySelector("input")!;
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ top: 60, bottom: 280 } as DOMRect);
    vi.spyOn(field, "getBoundingClientRect").mockReturnValue({ top: 260, bottom: 304, height: 44 } as DOMRect);
    field.focus();
    act(() => { viewport.height = 360; viewport.offsetTop = 20; viewport.dispatchEvent(new Event("resize")); });
    act(() => vi.advanceTimersByTime(180));
    expect(baseElement.querySelector(".modal-backdrop")).toHaveStyle({ "--modal-viewport-height": "360px", "--modal-viewport-offset-top": "20px" });
    expect(body.scrollTop).toBe(36);
    unmount();
    expect(document.body.style.position).not.toBe("fixed");
  });

  it("nie cofa ręcznego przewijania podczas przesuwania visual viewport", () => {
    vi.useFakeTimers();
    const viewport = Object.assign(new EventTarget(), { height: 360, offsetTop: 0 });
    vi.stubGlobal("visualViewport", viewport);
    const { baseElement, unmount } = render(<Modal open title="Dodaj" onClose={vi.fn()}><div data-modal-scroll-body><input aria-label="Nazwa" /></div></Modal>);
    const body = baseElement.querySelector<HTMLElement>("[data-modal-scroll-body]")!;
    const field = baseElement.querySelector("input")!;
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
    const { baseElement, unmount } = render(<Modal open title="Dodaj" onClose={vi.fn()}><div data-modal-scroll-body><input /><input /></div></Modal>);
    act(() => vi.advanceTimersByTime(180));
    const body = baseElement.querySelector<HTMLElement>("[data-modal-scroll-body]")!;
    const field = baseElement.querySelectorAll("input")[1]!;
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
    const { baseElement, rerender } = render(<Modal open {...props}><p>Treść</p></Modal>);

    rerender(<Modal open={false} {...props}><p>Treść</p></Modal>);

    const closingBackdrop = baseElement.querySelector(".modal-backdrop");
    expect(closingBackdrop).toHaveClass("modal-backdrop-closing");
    expect(closingBackdrop).toHaveAttribute("aria-hidden", "true");

    act(() => vi.advanceTimersByTime(160));
    expect(baseElement.querySelector(".modal-backdrop")).not.toBeInTheDocument();
  });

  it("przy reduced motion usuwa okno bez oczekiwania na animację", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)" }));
    const props = { title: "Test", onClose: vi.fn(), exitDurationMs: 160 };
    const { baseElement, rerender } = render(<Modal open {...props}><input /></Modal>);
    rerender(<Modal open={false} {...props}><input /></Modal>);
    expect(baseElement.querySelector(".modal-backdrop")).not.toBeInTheDocument();
  });

  it("przy 320 × 480 przekazuje geometrię visualViewport bez animacji wysokości", () => {
    const viewport = Object.assign(new EventTarget(), { height: 480, offsetTop: 0 });
    vi.stubGlobal("visualViewport", viewport);
    const { baseElement } = render(<Modal open title="Dodaj" onClose={vi.fn()}><div data-modal-scroll-body><input /></div></Modal>);
    act(() => { viewport.height = 248; viewport.dispatchEvent(new Event("resize")); });
    expect(baseElement.querySelector(".modal-backdrop")).toHaveStyle({ "--modal-viewport-height": "248px" });
    expect(baseElement.querySelectorAll("[data-modal-scroll-body]")).toHaveLength(1);
  });
});
