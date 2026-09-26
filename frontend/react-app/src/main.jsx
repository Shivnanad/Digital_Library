import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { XpProvider } from "./context/XpContext";
import "./styles/global.css";

// ── Global error handlers to prevent silent white-screen crashes ──
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason?.message || event.reason);
  // Prevent the browser from crashing on unhandled promise rejections
  event.preventDefault();
});

window.addEventListener("error", (event) => {
  console.error("[Global Error]", event.message, event.filename, event.lineno);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <XpProvider>
            <App />
          </XpProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
