import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Check, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/contexts/ConfigContext";
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
  const { signUp, signInWithGoogle } = useAuth();
  const { config } = useConfig();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { t } = useTranslation();
  const { toast } = useToast();

  // Check if reCAPTCHA is configured via Admin Panel (backend config)
  const isRecaptchaConfigured = config?.recaptchaEnabled && !!executeRecaptcha;

  // Phone mask input handler
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");

    if (value.length > 0) {
      if (value.length <= 4) {
        value = value;
      } else if (value.length <= 7) {
        value = `${value.slice(0, 4)} ${value.slice(4)}`;
      } else if (value.length <= 9) {
        value = `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7)}`;
      } else {
        value = `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7, 9)} ${value.slice(9, 11)}`;
      }
    }

    setPhone(value);
  };

  const validatePhone = (phone: string): boolean => {
    const digitsOnly = phone.replace(/\s/g, "");
    return digitsOnly.length === 11 && digitsOnly.startsWith("05");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // CRITICAL: reCAPTCHA is REQUIRED per PRODUCT_SPEC.md 5.1
    // Check backend config (Admin Panel)
    if (!isRecaptchaConfigured) {
      toast({
        title: t("auth.errors.recaptchaNotConfigured", "reCAPTCHA not configured"),
        description: t("auth.errors.contactAdmin", "Please contact administrator to configure reCAPTCHA (Admin Panel)"),
        variant: "destructive",
      });
      return;
    }

    // Validation
    if (!fullName.trim()) {
      toast({
        title: t("auth.requiredField"),
        description: t("auth.errors.nameRequired", "Full name is required"),
        variant: "destructive",
      });
      return;
    }

    if (!validatePhone(phone)) {
      toast({
        title: t("auth.invalidPhone"),
        description: t("auth.errors.phoneFormat", "Phone must be in format: 05XX XXX XX XX"),
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: t("auth.weakPassword"),
        description: t("auth.errors.passwordMinLength", "Password must be at least 6 characters"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const recaptchaToken = await executeRecaptcha!("register");

      await signUp(
        {
          email,
          password,
          fullName: fullName.trim(),
          phone: phone.replace(/\s/g, ""),
        },
        recaptchaToken
      );

      toast({
        title: t("auth.registerSuccess"),
        description: t("auth.messages.welcomeMessage", "Welcome to LeadHunter!"),
      });

      navigate("/app/search");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: t("auth.errors.registrationFailed", "Registration failed"),
        description: error.message || t("auth.errors.tryAgain", "Please try again"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Check if Google OAuth is configured via Admin Panel (backend config)
    if (!config?.googleOAuthEnabled) {
      toast({
        title: t("auth.errors.oauthNotConfigured", "Google OAuth not configured"),
        description: t("auth.errors.contactAdmin", "Please contact administrator to configure Google OAuth (Admin Panel)"),
        variant: "destructive",
      });
      return;
    }

    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Google OAuth error:", error);
      toast({
        title: t("auth.errors.googleLoginFailed", "Google login failed"),
        description: error.message || t("auth.errors.tryAgain", "Please try again"),
        variant: "destructive",
      });
    }
  };

  const benefits = [
    "100 ücretsiz kredi ile başlayın",
    "Kredi kartı gerekmez",
    "Anında erişim",
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left side - Visual */}
      <div className="hidden lg:flex flex-1 hero-gradient items-center justify-center p-12">
        <div className="max-w-md text-primary-foreground">
          <h2 className="text-3xl font-bold mb-6">
            {t("auth.getStarted", "Hemen Başlayın")}
          </h2>
          <p className="text-primary-foreground/80 mb-8">
            {t("auth.registerDescription", "Ücretsiz hesap oluşturun ve Türkiye'nin en kapsamlı işletme veritabanına erişin.")}
          </p>
          <ul className="space-y-4">
            {benefits.map((benefit, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center">
            <Link to="/" className="inline-block text-3xl font-bold mb-2">
              <span className="text-primary">Lead</span>
              <span className="text-foreground">Hunter</span>
            </Link>
            <h1 className="text-2xl font-semibold mt-6">{t("auth.register")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("auth.createFreeAccount", "Ücretsiz hesabınızı oluşturun ve hemen başlayın")}
            </p>
          </div>

          {/* Backend Config Warning - reCAPTCHA not configured */}
          {!isRecaptchaConfigured && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{t("auth.errors.recaptchaNotConfigured", "reCAPTCHA yapılandırılmadı")}</strong> (Admin Panel)
                <br />
                {t("auth.errors.registrationDisabled", "Kayıt geçici olarak devre dışı.")}
              </AlertDescription>
            </Alert>
          )}

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
                  disabled={!isRecaptchaConfigured}
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">{t("auth.phone")}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t("auth.phonePlaceholder")}
                  className="pl-10"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={15}
                  required
                  disabled={!isRecaptchaConfigured}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("auth.phoneFormat", "Format: 05XX XXX XX XX")}
              </p>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={!isRecaptchaConfigured}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")}
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={!isRecaptchaConfigured}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={!isRecaptchaConfigured}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("auth.passwordHint", "En az 6 karakter")}
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!isRecaptchaConfigured || isLoading}
            >
              {isLoading ? t("common.loading") : t("auth.register")}
              {!isLoading && <ArrowRight className="w-5 h-5" />}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t("common.or", "veya")}
                </span>
              </div>
            </div>


            {/* Google OAuth Button - Only show if enabled in Admin Panel */}
            {config?.googleOAuthEnabled && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleGoogleLogin}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {t("auth.googleLogin")}
              </Button>
            )}
          </form>

          <p className="text-center text-muted-foreground">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t("auth.login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
