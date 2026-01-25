# Backend-Driven Auth Configuration - New Diff

## Overview
Complete refactoring to use **backend Admin Panel configuration** instead of ENV variables.

---

## 1. New File: ConfigContext.tsx

**Purpose**: Fetch auth configuration from backend `/api/config/auth`

```typescript
// src/contexts/ConfigContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type AuthConfig = {
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string | null;
  googleOAuthEnabled: boolean;
};

type ConfigContextType = {
  config: AuthConfig | null;
  loading: boolean;
  error: string | null;
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_URL}/api/config/auth`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch auth configuration');
        }
        
        const data = await response.json();
        setConfig(data);
      } catch (err: any) {
        console.error('Config fetch error:', err);
        setError(err.message);
        // Set default disabled config on error
        setConfig({
          recaptchaEnabled: false,
          recaptchaSiteKey: null,
          googleOAuthEnabled: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading, error }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
```

**Key Points**:
- ✅ Fetches from `GET /api/config/auth`
- ✅ Returns `{ recaptchaEnabled, recaptchaSiteKey, googleOAuthEnabled }`
- ✅ Loading state while fetching
- ✅ Falls back to disabled config on error

---

## 2. main.tsx - Remove ENV Dependency

```typescript
// Before: ENV-based conditional provider
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";
createRoot(document.getElementById("root")!).render(
  <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
    <App />
  </GoogleReCaptchaProvider>
);

// After: Config provider only
import { ConfigProvider } from "./contexts/ConfigContext";

createRoot(document.getElementById("root")!).render(
  <ConfigProvider>
    <App />
  </ConfigProvider>
);
```

**Changes**:
- ❌ Removed ENV variable usage
- ✅ Only ConfigProvider wraps app
- ✅ reCAPTCHA provider moved to App.tsx (conditional on config)

---

## 3. App.tsx - Backend Config + Loading State

```typescript
import { useConfig } from "@/contexts/ConfigContext";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

const AppContent = () => {
  const { config, loading } = useConfig();

  // Show loading spinner while fetching config from backend
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  const appContent = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* ... routes */}
      </AuthProvider>
    </QueryClientProvider>
  );

  // Conditionally wrap with reCAPTCHA provider based on BACKEND config
  if (config?.recaptchaEnabled && config?.recaptchaSiteKey) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={config.recaptchaSiteKey}>
        {appContent}
      </GoogleReCaptchaProvider>
    );
  }

  return appContent;
};

const App = () => <AppContent />;
```

**Key Changes**:
- ✅ Shows loading screen while fetching config
- ✅ Conditional reCAPTCHA provider based on `config.recaptchaEnabled` + `config.recaptchaSiteKey`
- ✅ No ENV usage

---

## 4. Register.tsx - Backend Config Check

```typescript
import { useConfig } from "@/contexts/ConfigContext";

export default function Register() {
  const { config } = useConfig();  // Backend config
  const { executeRecaptcha } = useGoogleReCaptcha();

  // Check BACKEND config (not ENV)
  const isRecaptchaConfigured = config?.recaptchaEnabled && !!executeRecaptcha;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Block registration if not configured via Admin Panel
    if (!isRecaptchaConfigured) {
      toast({
        title: "reCAPTCHA not configured",
        description: "Please contact administrator (Admin Panel)",
        variant: "destructive",
      });
      return;
    }
    // ... rest of registration
  };

  const handleGoogleLogin = async () => {
    // Check BACKEND config for OAuth
    if (!config?.googleOAuthEnabled) {
      toast({
        title: "Google OAuth not configured",
        description: "Please contact administrator (Admin Panel)",
        variant: "destructive",
      });
      return;  // Block OAuth flow
    }

    try {
      await signInWithGoogle();
    } catch (error) {
      // Handle errors
    }
  };

  return (
    <div>
      {/* Show alert if reCAPTCHA not configured */}
      {!isRecaptchaConfigured && (
        <Alert variant="destructive">
          reCAPTCHA yapılandırılmadı (Admin Panel).
          Kayıt geçici olarak devre dışı.
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* All form fields disabled if not configured */}
        <Input disabled={!isRecaptchaConfigured} />
        <Button disabled={!isRecaptchaConfigured || isLoading}>Kayıt Ol</Button>
      </form>

      <Button onClick={handleGoogleLogin}>Google OAuth</Button>
    </div>
  );
}
```

**Key Changes**:
- ❌ No ENV usage
- ✅ Uses `config.recaptchaEnabled` from backend
- ✅ Checks `config.googleOAuthEnabled` BEFORE OAuth flow
- ✅ Blocks registration if reCAPTCHA not configured
- ✅ Shows error alert
- ✅ Disables all form fields

---

## 5. Login.tsx - Backend Config Check for OAuth

```typescript
import { useConfig } from "@/contexts/ConfigContext";

export default function Login() {
  const { config } = useConfig();

  const handleGoogleLogin = async () => {
    // Check BACKEND config BEFORE attempting OAuth
    if (!config?.googleOAuthEnabled) {
      toast({
        title: "Google OAuth not configured",
        description: "Please contact administrator (Admin Panel)",
        variant: "destructive",
      });
      return;  // Block flow
    }

    try {
      await signInWithGoogle();
    } catch (error) {
      toast({ title: "Google login failed", variant: "destructive" });
    }
  };

  return (
    <Button onClick={handleGoogleLogin}>Google ile Giriş</Button>
  );
}
```

---

## 6. Backend API Endpoint (Required)

**Endpoint**: `GET /api/config/auth`

**Response**:
```json
{
  "recaptchaEnabled": boolean,
  "recaptchaSiteKey": string | null,
  "googleOAuthEnabled": boolean
}
```

**Example Implementation**:
```javascript
// api/routes/config.js
router.get('/config/auth', async (req, res) => {
  try {
    // Fetch from system_settings table (Admin Panel config)
    const settings = await db.query(`
      SELECT 
        recaptcha_enabled,
        recaptcha_site_key,
        google_oauth_enabled
      FROM system_settings
      WHERE id = 1
    `);

    res.json({
      recaptchaEnabled: settings.recaptcha_enabled || false,
      recaptchaSiteKey: settings.recaptcha_site_key || null,
      googleOAuthEnabled: settings.google_oauth_enabled || false,
    });
  } catch (error) {
    console.error('Config fetch error:', error);
    // Return disabled config on error
    res.json({
      recaptchaEnabled: false,
      recaptchaSiteKey: null,
      googleOAuthEnabled: false,
    });
  }
});
```

---

## Summary Table

| Feature | Old (ENV) | New (Backend Config) |
|---------|-----------|----------------------|
| **Config Source** | `VITE_RECAPTCHA_SITE_KEY` | `GET /api/config/auth` |
| **Loading State** | ❌ None | ✅ Shows spinner |
| **reCAPTCHA Check** | `!!executeRecaptcha` | `config.recaptchaEnabled && !!executeRecaptcha` |
| **OAuth Check** | Try → catch error | `if (!config.googleOAuthEnabled) return;` |
| **Registration Block** | ENV missing | Backend config `recaptchaEnabled: false` |
| **Production** | ENV variables | Admin Panel UI |

---

## Files Changed

1. **NEW**: `src/contexts/ConfigContext.tsx` - Config fetching
2. **UPDATED**: `src/main.tsx` - Removed ENV, added ConfigProvider
3. **UPDATED**: `src/App.tsx` - Loading state + conditional provider
4. **UPDATED**: `src/pages/Register.tsx` - Backend config checks
5. **UPDATED**: `src/pages/Login.tsx` - Backend config checks
6. **REQUIRED**: Backend `GET /api/config/auth` endpoint

---

## Environment Variables

**Only for backend API URL**:
```env
VITE_API_URL=http://localhost:3001
```

**No third-party keys in ENV**. All configured via Admin Panel → Database → `/api/config/auth`.

---

## Compliance

✅ **Admin Panel Rule**: Keys configured in Admin Panel, not ENV  
✅ **PRODUCT_SPEC.md 5.1**: reCAPTCHA required on register  
✅ **Loading State**: Shows spinner while fetching config  
✅ **Graceful Fallback**: Disables features if config fetch fails  
✅ **OAuth Blocking**: Checks config BEFORE attempting OAuth flow
