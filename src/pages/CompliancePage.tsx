import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { DataSourceIndicator } from "@/components/common/DataSourceIndicator";
import { Shield, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CompliancePage() {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <section className="py-20">
                <div className="container max-w-4xl">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">
                            {t('compliance.pageTitle')}
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
                            {t('compliance.pageDescription')}
                        </p>
                        <div className="flex justify-center">
                            <DataSourceIndicator variant="full" />
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* What We Do */}
                        <div className="bg-card rounded-xl border p-8">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Check className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold mb-3">
                                        {t('compliance.whatWeDo.title')}
                                    </h2>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {t('compliance.whatWeDo.description')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* What We Don't Do */}
                        <div className="bg-card rounded-xl border p-8">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                                    <X className="w-6 h-6 text-destructive" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold mb-3">
                                        {t('compliance.whatWeDoNot.title')}
                                    </h2>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {t('compliance.whatWeDoNot.description')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Data Principles */}
                        <div className="bg-card rounded-xl border p-8">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Shield className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold mb-3">
                                        {t('compliance.dataPrinciples.title')}
                                    </h2>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {t('compliance.dataPrinciples.description')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <div className="bg-muted/30 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                            <p className="font-semibold mb-2">{t('compliance.disclaimer.title')}</p>
                            <p>{t('compliance.disclaimer.description')}</p>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
