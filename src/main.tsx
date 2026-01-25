import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

createRoot(document.getElementById("root")!).render(
    <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
        <App />
    </GoogleReCaptchaProvider>
);
