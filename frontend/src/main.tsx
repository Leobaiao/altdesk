import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Inicializa o tema o mais cedo possível para evitar flicker
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.setAttribute("data-theme", "dark");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
