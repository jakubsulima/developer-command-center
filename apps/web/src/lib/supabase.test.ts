import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveRuntimeConfig } from "./runtime";

describe("konfiguracja zarządzanego Supabase", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("w produkcji nie przechodzi po cichu na lokalny tryb demo", () => {
    expect(resolveRuntimeConfig({ PROD: true })).toMatchObject({
      backend: "supabase",
      configurationError: expect.stringContaining("VITE_SUPABASE_URL")
    });
  });

  it("pozwala jawnie uruchomić odseparowane demo", () => {
    expect(resolveRuntimeConfig({ PROD: true, VITE_DATA_BACKEND: "demo" })).toEqual({
      backend: "demo",
      demoEnabled: true
    });
  });

  it("odrzuca nieznany backend i pozwala jawnie włączyć demo obok SaaS", () => {
    expect(resolveRuntimeConfig({ VITE_DATA_BACKEND: "filesystem" })).toMatchObject({
      backend: "supabase",
      demoEnabled: false,
      configurationError: expect.stringContaining("supabase")
    });
    expect(resolveRuntimeConfig({
      VITE_DATA_BACKEND: "supabase",
      VITE_ENABLE_DEMO_MODE: " TRUE ",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test"
    })).toMatchObject({ backend: "supabase", demoEnabled: true });
  });

  it("odrzuca HTTP i klucze o podwyższonych uprawnieniach", () => {
    expect(resolveRuntimeConfig({
      VITE_DATA_BACKEND: "supabase",
      VITE_SUPABASE_URL: "http://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test"
    }).configurationError).toContain("HTTPS");
    expect(resolveRuntimeConfig({
      VITE_DATA_BACKEND: "supabase",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test"
    }).configurationError).toContain("publishable");
  });

  it("tworzy jeden współdzielony klient wyłącznie z publishable key", async () => {
    vi.stubEnv("VITE_DATA_BACKEND", "supabase");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { getSupabase } = await import("./supabase");
    expect(getSupabase()).toBe(getSupabase());
  });

  it("odrzuca uruchomienie klienta, gdy wybrano SaaS bez konfiguracji", async () => {
    vi.stubEnv("VITE_DATA_BACKEND", "supabase");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const { getSupabase } = await import("./supabase");
    expect(() => getSupabase()).toThrow("VITE_SUPABASE_URL");
  });
});
