import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyTheme, getCurrentTheme } from "./lib/preferences";

applyTheme(getCurrentTheme());

createRoot(document.getElementById("root")!).render(<App />);
