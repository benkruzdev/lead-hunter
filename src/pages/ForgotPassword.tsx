import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const { resetPassword } = useAuth();
    const { t } = useTranslation();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await resetPassword(email);

            setEmailSent(true);
            toast({
                title: t("auth.resetLinkSent"),
                description: t("auth.messages.checkEmail", "Please check your email"),
            });
        } catch (error: any) {
            console.error("Reset password error:", error);
            toast({
                title: t("auth.errors.resetFailed", "Password reset failed"),
                description: error.message || t("auth.errors.tryAgain", "Please try again"),
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-background to-primary/5">
            <div className="w-full max-w-md space-y-8 animate-fade-in">
                <div className="text-center">
                    <Link to="/" className="inline-block text-3xl font-bold mb-2">
                        <span className="text-primary">Lead</span>
                        <span className="text-foreground">Hunter</span>
                    </Link>
                    <h1 className="text-2xl font-semibold mt-6">
                        {t("auth.forgotPassword")}
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        {t("auth.forgotPasswordDescription", "Şifrenizi sıfırlamak için e-posta adresinizi girin")}
                    </p>
                </div>

                {!emailSent ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
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

                        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                            {isLoading ? t("common.loading") : t("auth.sendResetLink")}
                            {!isLoading && <ArrowRight className="w-5 h-5" />}
                        </Button>
                    </form>
                ) : (
                    <div className="text-center space-y-4 p-6 bg-primary/10 rounded-lg">
                        <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
                            <Mail className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg mb-2">
                                {t("auth.messages.emailSent", "E-posta Gönderildi")}
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                {t("auth.messages.resetEmailDescription", "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Spam klasörünü kontrol etmeyi unutmayın.")}
                            </p>
                        </div>
                    </div>
                )}

                <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t("auth.backToLogin")}
                </Link>
            </div>
        </div>
    );
}
