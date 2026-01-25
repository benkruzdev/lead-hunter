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
        // Fetch auth configuration from backend
        const fetchConfig = async () => {
            try {
                const API_URL = import.meta.env.VITE_API_URL;

                // CRITICAL: API URL must be configured
                if (!API_URL) {
                    throw new Error('VITE_API_URL not configured in environment variables');
                }

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
