import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getExports, downloadExport } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr, enUS } from "date-fns/locale";

interface Export {
  id: string;
  listId: string;
  listName: string;
  format: string;
  fileName: string;
  leadCount: number;
  note: string | null;
  createdAt: string;
}

export default function ExportsPage() {
  const { t, i18n } = useTranslation();
  const [exports, setExports] = useState<Export[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadExports();
  }, []);

  const loadExports = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getExports();
      setExports(data.exports);
    } catch (err: any) {
      console.error('[ExportsPage] Load failed:', err);
      setError(err.message || t('exports.createFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (exportId: string) => {
    try {
      setDownloadingId(exportId);
      const { downloadUrl } = await downloadExport(exportId);

      // Use window.location.href to avoid popup blockers
      window.location.href = downloadUrl;
    } catch (err: any) {
      console.error('[ExportsPage] Download failed:', err);
      alert(t('exports.createFailed'));
    } finally {
      setDownloadingId(null);
    }
  };

  const locale = i18n.language === 'tr' ? tr : enUS;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{t('exports.title')}</h2>
        <p className="text-muted-foreground mt-1">
          {t('exports.emptyDescription')}
        </p>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={loadExports}>
            {t('common.retry')}
          </Button>
        </div>
      ) : exports.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-soft p-12 text-center">
          <FileDown className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('exports.empty')}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3 text-left text-sm font-medium">{t('exports.fileName')}</th>
                  <th className="p-3 text-left text-sm font-medium">{t('exports.listName')}</th>
                  <th className="p-3 text-left text-sm font-medium">{t('exports.format')}</th>
                  <th className="p-3 text-left text-sm font-medium">{t('exports.leadCount')}</th>
                  <th className="p-3 text-left text-sm font-medium">{t('exports.createdAt')}</th>
                  <th className="p-3 text-left text-sm font-medium">{t('exports.note')}</th>
                  <th className="p-3 text-left text-sm font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {exports.map((exp) => (
                  <tr key={exp.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 text-sm">{exp.fileName}</td>
                    <td className="p-3 text-sm">{exp.listName}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {exp.format.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm">{exp.leadCount}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(exp.createdAt), { addSuffix: true, locale })}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {exp.note ? (
                        <span className="truncate max-w-xs block">{exp.note}</span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(exp.id)}
                        disabled={downloadingId === exp.id}
                      >
                        {downloadingId === exp.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('exports.downloading')}
                          </>
                        ) : (
                          <>
                            <FileDown className="w-4 h-4 mr-2" />
                            {t('exports.download')}
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
