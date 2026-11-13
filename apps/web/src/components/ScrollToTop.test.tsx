import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate, useSearchParams } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ScrollToTop } from "./ScrollToTop";

afterEach(() => vi.unstubAllGlobals());

function NavigationControls() {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  return <>
    <ScrollToTop />
    <button onClick={() => setParams({ preview: "one" }, { replace: true })}>Podgląd</button>
    <button onClick={() => setParams({ view: "overdue" })}>Filtr</button>
    <button onClick={() => navigate("/actions/one")}>Pełny widok</button>
    <button onClick={() => navigate(-1)}>Wstecz</button>
    <button onClick={() => navigate("/actions", { state: { navigationRestore: { scrollY: 200 } } })}>Powrót do listy</button>
  </>;
}

it("zachowuje przewinięcie przy podglądzie i filtrach, a resetuje po wejściu na nowy ekran", async () => {
  const scrollTo = vi.fn();
  vi.stubGlobal("scrollTo", scrollTo);
  vi.stubGlobal("scrollY", 200);
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/actions"]}><NavigationControls /></MemoryRouter>);

  await user.click(screen.getByRole("button", { name: "Podgląd" }));
  expect(scrollTo).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Filtr" }));
  expect(scrollTo).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Pełny widok" }));
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, left: 0, behavior: "auto" });
  await user.click(screen.getByRole("button", { name: "Wstecz" }));
  expect(scrollTo).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Pełny widok" }));
  await user.click(screen.getByRole("button", { name: "Powrót do listy" }));
  expect(scrollTo).toHaveBeenCalledTimes(2);
});
