# Diff/Patch Summary - Admin Panel Key Configuration

## 1. main.tsx

### Changes:
- Conditional reCAPTCHA provider wrapping
- App runs without provider if key not configured

```diff
 import { createRoot } from "react-dom/client";
 import App from "./App.tsx";
 import "./index.css";
 import "./lib/i18n";
 import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
 
+// reCAPTCHA key will be configured via Admin Panel
+// If not configured, reCAPTCHA features will be disabled
 const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";
 
 createRoot(document.getElementById("root")!).render(
+  recaptchaSiteKey ? (
     <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
-        <App />
+      <App />
     </GoogleReCaptchaProvider>
+  ) : (
+    <App />
+  )
 );
```

**Result**: App renders with or without reCAPTCHA provider.

---

## 2. Register.tsx

### Key Changes:
1. **Added Alert component import**
2. **Check if reCAPTCHA configured**: `const isRecaptchaConfigured = !!executeRecaptcha;`
3. **Block registration when not configured**
4. **Disable all form fields**
5. **Show error alert**
6. **Google OAuth error handling**

```diff
 import { Link } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
+import { Alert, AlertDescription } from "@/components/ui/alert";
 import { useState } from "react";
-import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Check } from "lucide-react";
+import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Check, AlertCircle } from "lucide-react";
 import { useNavigate } from "react-router-dom";
 import { useAuth } from "@/contexts/AuthContext";
 import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
 import { useTranslation } from "react-i18next";
 import { useToast } from "@/hooks/use-toast";
 
 export default function Register() {
   const [showPassword, setShowPassword] = useState(false);
   const [fullName, setFullName] = useState("");
   const [email, setEmail] = useState("");
   const [phone, setPhone] = useState("");
   const [password, setPassword] = useState("");
   const [isLoading, setIsLoading] = useState(false);
   const navigate = useNavigate();
-  const { signUp } = useAuth();
+  const { signUp, signInWithGoogle } = useAuth();
   const { executeRecaptcha } = useGoogleReCaptcha();
   const { t } = useTranslation();
   const { toast } = useToast();
+
+  // Check if reCAPTCHA is configured (Admin Panel requirement)
+  const isRecaptchaConfigured = !!executeRecaptcha;
 
   // ... (phone mask handler remains same)
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
-    if (!executeRecaptcha) {
+    // CRITICAL: reCAPTCHA is REQUIRED per PRODUCT_SPEC.md 5.1
+    // Registration is blocked if not configured
+    if (!isRecaptchaConfigured) {
       toast({
-        title: t("auth.errors.recaptchaFailed", "reCAPTCHA failed"),
-        description: t("auth.errors.tryAgain", "Please try again"),
+        title: t("auth.errors.recaptchaNotConfigured", "reCAPTCHA not configured"),
+        description: t("auth.errors.contactAdmin", "Please contact administrator to configure reCAPTCHA (Admin Panel)"),
         variant: "destructive",
       });
       return;
     }
     
     // ... (validation remains same)
 
     setIsLoading(true);
 
     try {
-      // Get reCAPTCHA token
-      const recaptchaToken = await executeRecaptcha("register");
+      // Get reCAPTCHA token (required)
+      const recaptchaToken = await executeRecaptcha!("register");
       
       // ... (rest of signup logic)
     } catch (error: any) {
       // ... (error handling)
     } finally {
       setIsLoading(false);
     }
   };
+
+  const handleGoogleLogin = async () => {
+    // Google OAuth - if not configured, Supabase will return error
+    try {
+      await signInWithGoogle();
+    } catch (error: any) {
+      console.error("Google OAuth error:", error);
+      
+      // Check if error is due to missing OAuth configuration
+      if (error.message?.includes("provider") || error.message?.includes("not enabled")) {
+        toast({
+          title: t("auth.errors.oauthNotConfigured", "Google OAuth not configured"),
+          description: t("auth.errors.contactAdmin", "Please contact administrator to configure Google OAuth (Admin Panel)"),
+          variant: "destructive",
+        });
+      } else {
+        toast({
+          title: t("auth.errors.googleLoginFailed", "Google login failed"),
+          description: error.message || t("auth.errors.tryAgain", "Please try again"),
+          variant: "destructive",
+        });
+      }
+    }
+  };
 
   // ... JSX return
   return (
     <div className="min-h-screen flex">
       {/* ... left side visual */}
       
       <div className="flex-1 flex items-center justify-center p-8">
         <div className="w-full max-w-md space-y-8 animate-fade-in">
           {/* ... header */}
 
+          {/* Configuration Warning - Shown when reCAPTCHA not configured */}
+          {!isRecaptchaConfigured && (
+            <Alert variant="destructive">
+              <AlertCircle className="h-4 w-4" />
+              <AlertDescription>
+                {t("auth.errors.recaptchaNotConfigured", "reCAPTCHA yapılandırılmadı")} (Admin Panel).
+                <br />
+                {t("auth.errors.registrationDisabled", "Kayıt geçici olarak devre dışı.")}
+              </AlertDescription>
+            </Alert>
+          )}
 
           <form onSubmit={handleSubmit} className="space-y-6">
             {/* Full Name */}
             <div className="space-y-2">
               <Label htmlFor="fullName">{t("auth.fullName")}</Label>
               <div className="relative">
                 <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                 <Input
                   id="fullName"
                   type="text"
                   placeholder={t("auth.fullNamePlaceholder")}
                   className="pl-10"
                   value={fullName}
                   onChange={(e) => setFullName(e.target.value)}
                   required
+                  disabled={!isRecaptchaConfigured}
                 />
               </div>
             </div>
 
             {/* Phone - Same disabled prop */}
+            disabled={!isRecaptchaConfigured}
 
             {/* Email - Same disabled prop */}
+            disabled={!isRecaptchaConfigured}
 
             {/* Password - Same disabled prop */}
+            disabled={!isRecaptchaConfigured}
 
             {/* Submit Button - Disabled when reCAPTCHA not configured */}
             <Button 
               type="submit" 
               size="lg" 
               className="w-full" 
-              disabled={isLoading}
+              disabled={!isRecaptchaConfigured || isLoading}
             >
               {isLoading ? t("common.loading") : t("auth.register")}
               {!isLoading && <ArrowRight className="w-5 h-5" />}
             </Button>
 
             {/* ... divider */}
 
             {/* Google OAuth Button */}
             <Button
               type="button"
               variant="outline"
               size="lg"
               className="w-full"
+              onClick={handleGoogleLogin}
             >
               {/* Google SVG logo */}
               {t("auth.googleLogin")}
             </Button>
           </form>
           
           {/* ... already have account link */}
         </div>
       </div>
     </div>
   );
 }
```

---

## Environment Variable

**Variable Name**: `VITE_RECAPTCHA_SITE_KEY`

**Usage**:
- `.env.local` (development): Optional, for local testing
- Production: Will be configured via Admin Panel (not env variable)

**Behavior**:
- **If defined**: reCAPTCHA provider active, registration enabled
- **If undefined or empty**: Provider not loaded, registration blocked with error

---

## Summary

| Feature | With Key | Without Key |
|---------|----------|-------------|
| **reCAPTCHA Provider** | ✅ Loaded | ❌ Not loaded |
| **Registration Form** | ✅ Enabled | 🚫 Disabled (all fields) |
| **Submit Button** | ✅ Enabled | 🚫 Disabled |
| **Error Alert** | ❌ Not shown | 🔴 Shown (red alert) |
| **Google OAuth** | ✅ Works (if configured in Supabase) | 🔴 Shows error on click |

**Compliance**: ✅ PRODUCT_SPEC.md 5.1 - Captcha zorunlu on register
