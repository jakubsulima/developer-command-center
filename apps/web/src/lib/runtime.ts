export type DataBackend = "demo" | "supabase";

type RuntimeEnvironment = {
  PROD?: boolean;
  VITE_DATA_BACKEND?: string;
  VITE_ENABLE_DEMO_MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export type RuntimeConfig = {
  backend: DataBackend;
  demoEnabled: boolean;
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
      configurationError: "VITE_DATA_BACKEND musi mieć wartość „supabase” albo „demo”."
    };
  }

  if (backend === "demo") return { backend, demoEnabled: true };

  const url = environment.VITE_SUPABASE_URL?.trim();
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    return {
      backend,
      demoEnabled,
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
      configurationError: "VITE_SUPABASE_URL musi być poprawnym adresem HTTPS zarządzanego projektu Supabase."
    };
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    return {
      backend,
      demoEnabled,
      configurationError: "Użyj nowego klucza publishable (sb_publishable_…), nigdy secret ani service_role."
    };
  }

  return { backend, demoEnabled, supabase: { url, publishableKey } };
}

export const runtimeConfig = resolveRuntimeConfig(import.meta.env);
export const isSupabaseConfigured = runtimeConfig.backend === "supabase" && Boolean(runtimeConfig.supabase) && !runtimeConfig.configurationError;

export function requireSupabaseConfig() {
  if (!runtimeConfig.supabase || runtimeConfig.configurationError) {
    throw new Error(runtimeConfig.configurationError ?? "Supabase nie jest skonfigurowany.");
  }
  return runtimeConfig.supabase;
}
