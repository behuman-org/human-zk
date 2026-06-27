import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { I18nProvider } from "./i18n/I18nProvider.tsx";
import { bootstrapAppPreferences } from "./preferences/AppPreferencesProvider.tsx";
import "./styles/global.css";

bootstrapAppPreferences();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <App />
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
