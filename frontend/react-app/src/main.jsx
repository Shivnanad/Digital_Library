import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { XpProvider } from "./context/XpContext";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <XpProvider>
          <App />
        </XpProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);
