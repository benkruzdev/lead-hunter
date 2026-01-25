import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { updatePassword } = useAuth();
    const { t } = useTranslation();
    const { toast } = useToast();

    // Verify that we have a valid reset token from URL
    useEffect(() => {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        if (type !== 'recovery' || !accessToken) {
            toast({
                title: t("auth.errors.invalidResetLink", "Invalid reset link"),
                description: t("auth.errors.requestNewLink", "Please request a new password reset link"),
                variant: "destructive",
            });
            navigate("/forgot-password");
        }
    }, [navigate, toast, t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast({
                title: t("auth.passwordMismatch"),
                description: t("auth.errors.passwordsDoNotMatch", "Passwords do not match"),
                variant: "destructive",
            });
            return;
        }

        if (newPassword.length < 6) {
            toast({
                title: t("auth.weakPassword"),
                description: t("auth.errors.passwordMinLength", "Password must be at least 6 characters"),
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            await updatePassword(newPassword);

            toast({
                title: t("auth.passwordUpdated"),
                description: t("auth.messages.passwordResetSuccess", "Your password has been updated"),
            });

            // Redirect to login
            navigate("/login");
        } catch (error: any) {
            console.error("Update password error:", error);
            toast({
                title: t("auth.errors.passwordUpdateFailed", "Password update failed"),
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
                        {t("auth.resetPassword")}
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        {t("auth.resetPasswordDescription", "Yeni şifrenizi belirleyin")}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* New Password */}
                    <div className="space-y-2">
                        <Label htmlFor="newPassword">{t("auth.newPassword")}</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                id="newPassword"
                                type={showPassword ? "text" : "password"}
                                placeholder={t("auth.passwordPlaceholder")}
                                className="pl-10 pr-10"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
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
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                id="confirmPassword"
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder={t("auth.passwordPlaceholder")}
                                className="pl-10 pr-10"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t("auth.passwordHint", "En az 6 karakter")}
                        </p>
                    </div>

                    <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                        {isLoading ? t("common.loading") : t("auth.updatePassword")}
                        {!isLoading && <ArrowRight className="w-5 h-5" />}
                    </Button>
                </form>
            </div>
        </div>
    );
}
