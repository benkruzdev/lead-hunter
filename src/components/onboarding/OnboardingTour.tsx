import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { updateProfile } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type OnboardingStep = {
    title: string;
    description: string;
    target: string;
    position: "top" | "bottom" | "left" | "right";
};

type OnboardingTourProps = {
    onComplete: () => void;
};

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isCompleting, setIsCompleting] = useState(false);
    const { t } = useTranslation();
    const { refreshProfile } = useAuth();

    // 6 steps per PRODUCT_SPEC.md
    const steps: OnboardingStep[] = [
        {
            title: t("onboarding.step1.title", "Şehir Seç"),
            description: t("onboarding.step1.description", "Aramaya başlamak için önce bir şehir seçin"),
            target: "[data-onboarding='city-select']",
            position: "bottom",
        },
        {
            title: t("onboarding.step2.title", "İlçe Seç"),
            description: t("onboarding.step2.description", "Şehri seçtikten sonra ilçeyi belirleyin"),
            target: "[data-onboarding='district-select']",
            position: "bottom",
        },
        {
            title: t("onboarding.step3.title", "Kategori Yaz"),
            description: t("onboarding.step3.description", "Aradığınız işletme kategorisini yazın (örn: restoran, kafe)"),
            target: "[data-onboarding='category-input']",
            position: "bottom",
        },
        {
            title: t("onboarding.step4.title", "Ara"),
            description: t("onboarding.step4.description", "Arama butonuna tıklayarak sonuçları görüntüleyin"),
            target: "[data-onboarding='search-button']",
            position: "left",
        },
        {
            title: t("onboarding.step5.title", "Listeye Ekle"),
            description: t("onboarding.step5.description", "Sonuçlardan istediğiniz işletmeleri listeye ekleyin"),
            target: "[data-onboarding='add-to-list']",
            position: "left",
        },
        {
            title: t("onboarding.step6.title", "CSV İndir"),
            description: t("onboarding.step6.description", "Oluşturduğunuz listeyi CSV olarak indirin"),
            target: "[data-onboarding='export-csv']",
            position: "top",
        },
    ];

    const currentStepData = steps[currentStep];

    // Get target element position
    const getTargetPosition = () => {
        const targetElement = document.querySelector(currentStepData.target);
        if (!targetElement) return null;

        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        return {
            top: rect.top + scrollTop,
            left: rect.left + scrollLeft,
            width: rect.width,
            height: rect.height,
        };
    };

    const targetPos = getTargetPosition();

    // Calculate tooltip position based on target and preferred position
    const getTooltipStyle = (): React.CSSProperties => {
        if (!targetPos) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

        const offset = 20;
        let top = 0;
        let left = 0;

        switch (currentStepData.position) {
            case "bottom":
                top = targetPos.top + targetPos.height + offset;
                left = targetPos.left + targetPos.width / 2;
                return { top: `${top}px`, left: `${left}px`, transform: "translateX(-50%)" };

            case "top":
                top = targetPos.top - offset;
                left = targetPos.left + targetPos.width / 2;
                return { top: `${top}px`, left: `${left}px`, transform: "translate(-50%, -100%)" };

            case "right":
                top = targetPos.top + targetPos.height / 2;
                left = targetPos.left + targetPos.width + offset;
                return { top: `${top}px`, left: `${left}px`, transform: "translateY(-50%)" };

            case "left":
                top = targetPos.top + targetPos.height / 2;
                left = targetPos.left - offset;
                return { top: `${top}px`, left: `${left}px`, transform: "translate(-100%, -50%)" };

            default:
                return { top: `${targetPos.top}px`, left: `${targetPos.left}px` };
        }
    };

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = async () => {
        setIsCompleting(true);

        try {
            // Save onboarding_completed = true via backend
            await updateProfile({ onboarding_completed: true });

            // Refresh profile to get updated data
            await refreshProfile();

            // Notify parent component
            onComplete();
        } catch (error) {
            console.error("Failed to save onboarding completion:", error);
            // Continue anyway
            onComplete();
        } finally {
            setIsCompleting(false);
        }
    };

    const handleSkip = async () => {
        // Also save as completed when skipped
        await handleComplete();
    };

    // Scroll to target element when step changes
    useEffect(() => {
        const targetElement = document.querySelector(currentStepData.target);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [currentStep]);

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/50 z-[100] pointer-events-none" />

            {/* Highlight target element */}
            {targetPos && (
                <div
                    className="fixed z-[101] pointer-events-none"
                    style={{
                        top: `${targetPos.top - 4}px`,
                        left: `${targetPos.left - 4}px`,
                        width: `${targetPos.width + 8}px`,
                        height: `${targetPos.height + 8}px`,
                        boxShadow: "0 0 0 4px rgba(255, 255, 255, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)",
                        borderRadius: "8px",
                    }}
                />
            )}

            {/* Tooltip Card */}
            <Card
                className="fixed z-[102] w-80 shadow-2xl animate-fade-in"
                style={getTooltipStyle()}
            >
                <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">
                                {t("onboarding.stepCounter", `Adım ${currentStep + 1}/${steps.length}`)}
                            </p>
                            <h3 className="text-lg font-semibold">{currentStepData.title}</h3>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 -mr-2 -mt-2"
                            onClick={handleSkip}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground mb-6">
                        {currentStepData.description}
                    </p>

                    {/* Navigation */}
                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrevious}
                            disabled={currentStep === 0}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            {t("onboarding.previous", "Geri")}
                        </Button>

                        <div className="flex gap-1">
                            {steps.map((_, index) => (
                                <div
                                    key={index}
                                    className={`h-1.5 w-1.5 rounded-full ${index === currentStep ? "bg-primary" : "bg-muted"
                                        }`}
                                />
                            ))}
                        </div>

                        <Button
                            size="sm"
                            onClick={handleNext}
                            disabled={isCompleting}
                        >
                            {currentStep === steps.length - 1
                                ? isCompleting
                                    ? t("common.loading", "Yükleniyor...")
                                    : t("onboarding.finish", "Bitir")
                                : t("onboarding.next", "İleri")}
                            {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
