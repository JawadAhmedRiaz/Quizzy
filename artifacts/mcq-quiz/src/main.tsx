import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Automatically include session credentials for all internal API calls
const originalFetch = window.fetch;
window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("/api/") || url.startsWith("/api")) {
    init = { credentials: "include", ...init };
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
