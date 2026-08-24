import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppErrorReporter } from "./lib/appErrorReporter";
import { AuthGate } from "./auth/AuthGate";
import { AuthRoot } from "./auth/AuthRoot";
import "./styles.css";

AppErrorReporter.install();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 1 }
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppErrorBoundary><AuthRoot><AuthGate><App /></AuthGate></AuthRoot></AppErrorBoundary>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
