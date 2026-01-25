import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

// reCAPTCHA key will be configured via Admin Panel
// If not configured, reCAPTCHA features will be disabled
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

createRoot(document.getElementById("root")!).render(
    recaptchaSiteKey ? (
        <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
            <App />
        </GoogleReCaptchaProvider>
    ) : (
        <App />
    )
);
