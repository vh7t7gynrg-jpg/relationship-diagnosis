import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import Home from "./page";

const root = document.getElementById("root");

if (!root) throw new Error("Missing root element");

createRoot(root).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
