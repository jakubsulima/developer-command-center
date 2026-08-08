import { describe, expect, it } from "vitest";
import { parseQuickAddCommand } from "./quickAdd";

describe("quick add commands", () => {
  it.each([
    ["/zadanie Spisać pytania", "action", "Spisać pytania"],
    ["/działanie Odpisać Ani", "action", "Odpisać Ani"],
    ["/cel Uporządkować finanse", "goal", "Uporządkować finanse"],
    ["/wiedza Wzorzec repozytorium", "knowledge", "Wzorzec repozytorium"],
    ["/notatka Pytania do rozmowy", "knowledge", "Pytania do rozmowy"],
    ["/inbox Luźna myśl", "inbox", "Luźna myśl"]
  ] as const)("rozpoznaje %s", (value, mode, content) => {
    expect(parseQuickAddCommand(value)).toEqual({ mode, content });
  });

  it("nie przełącza trybu przed wpisaniem spacji ani dla nieznanej komendy", () => {
    expect(parseQuickAddCommand("/cel")).toBeUndefined();
    expect(parseQuickAddCommand("/nieznana treść")).toBeUndefined();
  });
});
