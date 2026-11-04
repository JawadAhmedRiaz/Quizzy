import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const CLERK_PUBLISHABLE_KEY =
  (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY ||
  "pk_test_aG9wZWZ1bC1kdWNrbGluZy0yNDMyLmNsZXJrLmFjY291bnRzLmRldiQ";

// Automatically include session credentials and Clerk Bearer token for all internal API calls
const originalFetch = window.fetch;
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("/api/") || url.startsWith("/api")) {
    init = { credentials: "include", ...init };

    try {
      const token = await (window as any).Clerk?.session?.getToken();
      if (token) {
        const headers = new Headers(init.headers || {});
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        init.headers = headers;
      }
    } catch {
      // Ignore if Clerk session not yet ready
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
    <App />
  </ClerkProvider>,
);
