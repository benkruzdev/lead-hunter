import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { ConfigProvider } from "./contexts/ConfigContext";

createRoot(document.getElementById("root")!).render(
    <ConfigProvider>
        <App />
    </ConfigProvider>
);
