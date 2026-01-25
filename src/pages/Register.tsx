import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Check } from "lucide-react";
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
  const { signUp } = useAuth();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { t } = useTranslation();
  const { toast } = useToast();

  // Phone mask input handler
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove non-digits

    // Apply mask: 05XX XXX XX XX
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

  // Validate Turkish phone format
  const validatePhone = (phone: string): boolean => {
    const digitsOnly = phone.replace(/\s/g, "");
    return digitsOnly.length === 11 && digitsOnly.startsWith("05");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!executeRecaptcha) {
      toast({
        title: t("auth.errors.recaptchaFailed", "reCAPTCHA failed"),
        description: t("auth.errors.tryAgain", "Please try again"),
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
      // Get reCAPTCHA token
      const recaptchaToken = await executeRecaptcha("register");

      // Sign up with Supabase
      await signUp(
        {
          email,
          password,
          fullName: fullName.trim(),
          phone: phone.replace(/\s/g, ""), // Remove spaces
        },
        recaptchaToken
      );

      toast({
        title: t("auth.registerSuccess"),
        description: t("auth.messages.welcomeMessage", "Welcome to LeadHunter!"),
      });

      // Navigate to app
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("auth.passwordHint", "En az 6 karakter")}
              </p>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? t("common.loading") : t("auth.register")}
              {!isLoading && <ArrowRight className="w-5 h-5" />}
            </Button>
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
