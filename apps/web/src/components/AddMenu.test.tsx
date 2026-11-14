import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AddMenu } from "./AddMenu";

const items = [
  { label: "Działanie", icon: null, request: { mode: "action" as const, areaId: "project", draftKey: "project-actions" } },
  { label: "Grupa działań", icon: null, request: { mode: "goal" as const, areaId: "project" } },
  { label: "Decyzja", icon: null, request: { mode: "library" as const, libraryKind: "decision" as const, areaId: "project" } }
];

it("otwiera menu klawiaturą, obsługuje strzałki i Escape oraz zachowuje kontekst wyboru", async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  render(<AddMenu label="Dodaj" ariaLabel="Dodaj w Projekcie" items={items} onSelect={select} />);
  const trigger = screen.getByRole("button", { name: "Dodaj w Projekcie" });
  trigger.focus();
  await user.keyboard("{ArrowUp}");
  expect(screen.getByRole("menuitem", { name: "Decyzja" })).toHaveFocus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("menuitem", { name: "Działanie" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(select).toHaveBeenCalledExactlyOnceWith(items[0].request);
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("Tab i kliknięcie poza zamykają menu bez otwierania formularza", async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  render(<><AddMenu label="Dodaj" ariaLabel="Dodaj w Projekcie" items={items} onSelect={select} /><button>Dalsza kontrolka</button></>);
  const trigger = screen.getByRole("button", { name: "Dodaj w Projekcie" });
  await user.click(trigger);
  await user.tab();
  expect(screen.getByRole("button", { name: "Dalsza kontrolka" })).toHaveFocus();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Dalsza kontrolka" }));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(select).not.toHaveBeenCalled();
});
