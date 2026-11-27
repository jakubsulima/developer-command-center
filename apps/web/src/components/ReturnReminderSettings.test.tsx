import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReturnReminderSettings } from "./ReturnReminderSettings";

const mocks = vi.hoisted(() => ({
  mode: "supabase",
  loadReturnReminder: vi.fn(async () => null)
}));
vi.mock("../app/useStore", () => ({
  useStore: () => ({ state: { workspaceId: "workspace", workspaceTimezone: "Europe/Warsaw" }, mode: mocks.mode })
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("../data/returnReminders", () => ({ loadReturnReminder: mocks.loadReturnReminder }));

function renderSettings() {
  render(<QueryClientProvider client={new QueryClient()}><ReturnReminderSettings /></QueryClientProvider>);
  const summary = screen.getByText("Przypomnienia").closest("summary");
  expect(summary?.parentElement).not.toHaveAttribute("open");
  return summary;
}

function mockPushSupport(permission: NotificationPermission) {
  const notification = { permission, requestPermission: vi.fn() };
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("navigator", Object.create(window.navigator, { serviceWorker: { value: {} } }));
  return notification;
}

describe("dostępność przypomnień w zwiniętej sekcji ustawień", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); mocks.mode = "supabase"; });

  it("pokazuje brak konfiguracji wdrożenia przed rozwinięciem sekcji", () => {
    vi.stubEnv("VITE_WEB_PUSH_PUBLIC_KEY", "");
    mockPushSupport("granted");
    expect(renderSettings()).toHaveTextContent("Powiadomienia nie są dostępne w tym wdrożeniu.");
  });

  it("przy braku wsparcia wskazuje inną przeglądarkę i instalację na iPhonie", () => {
    vi.stubEnv("VITE_WEB_PUSH_PUBLIC_KEY", "configured");
    expect(renderSettings()).toHaveTextContent(/Użyj przeglądarki obsługującej powiadomienia.*ekranu początkowego/);
  });

  it("kieruje do ustawień zgody i reaguje na jej zmianę po powrocie do karty", async () => {
    vi.stubEnv("VITE_WEB_PUSH_PUBLIC_KEY", "configured");
    const notification = mockPushSupport("denied");
    const summary = renderSettings();
    expect(summary).toHaveTextContent("Odblokuj powiadomienia w ustawieniach przeglądarki lub urządzenia.");
    notification.permission = "granted";
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(summary).toHaveTextContent("Wybierz dni i porę powrotu do aplikacji");
    expect(notification.requestPermission).not.toHaveBeenCalled();
  });

  it("przy braku zgody blokuje formularz również po rozwinięciu sekcji", async () => {
    vi.stubEnv("VITE_WEB_PUSH_PUBLIC_KEY", "configured");
    mockPushSupport("denied");
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByText("Przypomnienia"));
    expect(screen.getByRole("group", { name: "Twój rytm" })).toBeDisabled();
  });

  it("w trybie demo wskazuje konieczność zalogowania", () => {
    mocks.mode = "demo";
    expect(renderSettings()).toHaveTextContent("Przypomnienia są wyłączone w trybie demo.");
  });
});
