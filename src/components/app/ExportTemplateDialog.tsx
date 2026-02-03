import { useTranslation } from "react-i18next";
import { FileSpreadsheet, Download, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface ExportTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedCount: number;
    onConfirm: (templateId: 'basic' | 'salesCrm' | 'outreach') => void;
}

export function ExportTemplateDialog({
    open,
    onOpenChange,
    selectedCount,
    onConfirm,
}: ExportTemplateDialogProps) {
    const { t } = useTranslation();
    const [selectedTemplate, setSelectedTemplate] = useState<'basic' | 'salesCrm' | 'outreach'>('basic');

    const handleDownload = () => {
        onConfirm(selectedTemplate);
        onOpenChange(false);
    };

    const templateOptions: Array<{ id: 'basic' | 'salesCrm' | 'outreach' }> = [
        { id: 'basic' },
        { id: 'salesCrm' },
        { id: 'outreach' },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        {t('exportTemplates.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('exportTemplates.description', { count: selectedCount })}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <RadioGroup value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v as any)}>
                        <div className="space-y-3">
                            {templateOptions.map((template) => (
                                <div
                                    key={template.id}
                                    className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer"
                                    onClick={() => setSelectedTemplate(template.id)}
                                >
                                    <RadioGroupItem value={template.id} id={template.id} className="mt-1" />
                                    <div className="flex-1">
                                        <Label htmlFor={template.id} className="cursor-pointer font-medium">
                                            {t(`exportTemplates.${template.id}.title`)}
                                        </Label>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {t(`exportTemplates.${template.id}.desc`)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </RadioGroup>
                </div>

                <DialogFooter className="flex-row justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="w-4 h-4 mr-1" />
                        {t('exportTemplates.cancel')}
                    </Button>
                    <Button onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-1" />
                        {t('exportTemplates.download')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
