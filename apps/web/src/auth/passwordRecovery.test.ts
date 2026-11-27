import { afterEach, describe, expect, it, vi } from "vitest";
import { openPasswordRecovery, requestPasswordReset } from "./passwordRecovery";

vi.mock("../lib/runtime", () => ({
  requireSupabaseConfig: () => ({ url: "https://project.supabase.co", publishableKey: "sb_publishable_test" })
}));

const recoveryUser = { id: "user", email: "user@example.com", app_metadata: {}, user_metadata: {} };
const authSession = {
  access_token: "recovery-access-token",
  refresh_token: "recovery-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: recoveryUser
};

describe("Supabase PKCE dla odzyskiwania hasła", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("wymienia jednorazowy kod z zapisanym verifierem i zmienia hasło w odizolowanej sesji", async () => {
    const calls: { url: URL; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const requestUrl = new URL(url);
      calls.push({ url: requestUrl, init });
      switch (requestUrl.pathname) {
        case "/auth/v1/recover": return Response.json({});
        case "/auth/v1/token": return Response.json(authSession);
        case "/auth/v1/user": return Response.json(recoveryUser);
        case "/auth/v1/logout": return new Response(null, { status: 204 });
        default: throw new Error("unexpected_auth_request");
      }
    });
    localStorage.setItem("sb-project-auth-token", "existing-app-session");
    await requestPasswordReset("user@example.com");
    expect(calls[0].url.searchParams.get("redirect_to")).toBe(`${window.location.origin}/reset-password`);
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ email: "user@example.com", code_challenge: expect.any(String), code_challenge_method: "s256" });
    const key = "command-password-recovery:project.supabase.co-code-verifier";
    const verifier = (JSON.parse(localStorage.getItem(key)!) as string).split("/")[0];
    expect(verifier.length).toBeGreaterThan(40);

    const recovery = await openPasswordRecovery("single-use-code");
    expect(calls[1].url.searchParams.get("grant_type")).toBe("pkce");
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ auth_code: "single-use-code", code_verifier: verifier });
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem("command-password-recovery:project.supabase.co")).toBeNull();
    expect(await recovery.updatePassword("new-strong-password")).toBe("saved");
    expect(JSON.parse(String(calls[2].init?.body))).toMatchObject({ password: "new-strong-password" });
    expect(new Headers(calls[2].init?.headers).get("Authorization")).toBe("Bearer recovery-access-token");
    expect(calls[3].url.searchParams.get("scope")).toBe("local");
    expect(localStorage.getItem("sb-project-auth-token")).toBe("existing-app-session");

    await expect(openPasswordRecovery("single-use-code")).rejects.toThrow("invalid_recovery_link");
    expect(calls).toHaveLength(4);
  });
});
