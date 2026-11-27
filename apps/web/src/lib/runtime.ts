export type DataBackend = "demo" | "supabase";

type RuntimeEnvironment = {
  PROD?: boolean;
  VITE_DATA_BACKEND?: string;
  VITE_ENABLE_DEMO_MODE?: string;
  VITE_ENABLE_SIGNUP?: string;
  VITE_ENABLE_PASSWORD_RESET?: string;
  VITE_AUTH_SUPPORT_EMAIL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export type RuntimeConfig = {
  backend: DataBackend;
  demoEnabled: boolean;
  signupEnabled: boolean;
  passwordResetEnabled?: boolean;
  authSupportEmail?: string;
  configurationError?: string;
  supabase?: {
    url: string;
    publishableKey: string;
  };
};

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function resolveRuntimeConfig(environment: RuntimeEnvironment): RuntimeConfig {
  const backend = (environment.VITE_DATA_BACKEND?.trim() || (environment.PROD ? "supabase" : "demo")) as DataBackend;
  const demoEnabled = backend === "demo" || enabled(environment.VITE_ENABLE_DEMO_MODE);

  if (backend !== "demo" && backend !== "supabase") {
    return {
      backend: "supabase",
      demoEnabled: false,
      signupEnabled: false,
      configurationError: "VITE_DATA_BACKEND musi mieć wartość „supabase” albo „demo”."
    };
  }

  const signupEnabled = enabled(environment.VITE_ENABLE_SIGNUP);

  if (backend === "demo") return { backend, demoEnabled: true, signupEnabled };

  const url = environment.VITE_SUPABASE_URL?.trim();
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    return {
      backend,
      demoEnabled,
      signupEnabled,
      configurationError: "Brakuje VITE_SUPABASE_URL lub VITE_SUPABASE_PUBLISHABLE_KEY."
    };
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:") throw new Error("insecure");
  } catch {
    return {
      backend,
      demoEnabled,
      signupEnabled,
      configurationError: "VITE_SUPABASE_URL musi być poprawnym adresem HTTPS zarządzanego projektu Supabase."
    };
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    return {
      backend,
      demoEnabled,
      signupEnabled,
      configurationError: "Użyj nowego klucza publishable (sb_publishable_…), nigdy secret ani service_role."
    };
  }

  const contact = environment.VITE_AUTH_SUPPORT_EMAIL?.trim();
  return {
    backend, demoEnabled, signupEnabled,
    passwordResetEnabled: environment.VITE_ENABLE_PASSWORD_RESET === undefined ? undefined : enabled(environment.VITE_ENABLE_PASSWORD_RESET),
    authSupportEmail: contact && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(contact) ? contact : undefined,
    supabase: { url, publishableKey }
  };
}

export const runtimeConfig = resolveRuntimeConfig(import.meta.env);
export const isSupabaseConfigured = runtimeConfig.backend === "supabase" && Boolean(runtimeConfig.supabase) && !runtimeConfig.configurationError;

export function requireSupabaseConfig() {
  if (!runtimeConfig.supabase || runtimeConfig.configurationError) {
    throw new Error(runtimeConfig.configurationError ?? "Supabase nie jest skonfigurowany.");
  }
  return runtimeConfig.supabase;
}
