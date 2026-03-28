import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { User, Mail, Phone, Lock, Globe, Trash2, Save, AlertTriangle, Shield, CreditCard, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { updateUserProfile, changeUserPassword, deleteUserAccount } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer } from '@/components/shared/PageContainer';
import { PageHeader } from '@/components/shared/PageHeader';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Safe frontend data-flow cleanup: rely solely on context profile, avoiding isolated page state
  const { profile, credits, refreshProfile, signOut, loading: authLoading } = useAuth();

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Sync internal form when context profile loads or changes
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Delete Account State
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      setProfileError(null);
      setProfileSuccess(false);

      if (!fullName.trim()) {
        setProfileError(t('settings.errors.fullNameRequired', 'Ad Soyad zorunludur.'));
        return;
      }

      if (!phone.trim()) {
        setProfileError(t('settings.errors.phoneRequired', 'Telefon numarası zorunludur.'));
        return;
      }

      await updateUserProfile(fullName, phone);
      
      // Keep app-wide auth state perfectly synchronized immediately after DB update
      await refreshProfile();
      
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error: any) {
      console.error('[Settings] Profile update failed:', error);
      setProfileError(error.message || t('settings.errors.updateFailed', 'Profil güncellenirken hata oluştu.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setIsChangingPassword(true);
      setPasswordError(null);
      setPasswordSuccess(false);

      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError(t('settings.errors.allFieldsRequired', 'Tüm alanları doldurunuz.'));
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError(t('settings.errors.passwordsDoNotMatch', 'Yeni şifreler eşleşmiyor.'));
        return;
      }

      if (newPassword.length < 6) {
        setPasswordError(t('settings.errors.passwordTooShort', 'Şifre en az 6 karakter olmalıdır.'));
        return;
      }

      await changeUserPassword(currentPassword, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error: any) {
      console.error('[Settings] Password change failed:', error);
      setPasswordError(error.message || t('settings.errors.passwordChangeFailed', 'Şifre değiştirilemedi.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await deleteUserAccount();
      await signOut();
      navigate('/login');
    } catch (error: any) {
      console.error('[Settings] Account deletion failed:', error);
      alert(error.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const formatPhoneForDisplay = (phoneDigits: string) => {
    if (!phoneDigits) return '';
    const cleaned = phoneDigits.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)}`;
    }
    return phoneDigits;
  };

  if (authLoading && !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initial = profile?.full_name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader 
        title={t('settings.title', 'Hesap Merkezi')} 
        description={t('settings.description', 'Kişisel profilinizi, güvenlik ayarlarınızı ve uygulama tercihlerinizi buradan yönetebilirsiniz.')} 
      />

      {/* Account Summary Block (Premium SaaS Feel) */}
      <div className="bg-card hover:bg-muted/10 border border-primary/10 rounded-2xl p-6 sm:p-8 mb-12 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm transition-colors">
        <div className="flex items-center gap-5 w-full sm:w-auto">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-2xl font-semibold text-primary">{initial}</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground truncate">{profile?.full_name || t('settings.anonymous', 'İsimsiz Kullanıcı')}</h2>
            <div className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
              <div className="flex items-center gap-1.5 shrink-0"><Mail className="w-3.5 h-3.5"/> <span className="truncate">{profile?.email || '—'}</span></div>
              <div className="flex items-center gap-1.5 shrink-0"><Phone className="w-3.5 h-3.5"/> <span>{formatPhoneForDisplay(profile?.phone || '') || '—'}</span></div>
            </div>
          </div>
        </div>
        
        {/* Billing/Credits Shortcut */}
        <div className="flex flex-col items-center sm:items-end gap-1.5 bg-background sm:bg-transparent w-full sm:w-auto p-4 sm:p-0 rounded-xl sm:rounded-none border sm:border-none">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('dashboard.creditsRemaining', 'Kalan Krediniz')}</div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning shrink-0" />
            <span className="text-2xl font-bold tabular-nums text-foreground">{credits?.toLocaleString() ?? 0}</span>
          </div>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-1 text-primary hover:text-primary/80" onClick={() => navigate('/app/billing')}>
            {t('layout.buyCredits', 'Bakiye Yükle')} <ArrowRight className="w-3 h-3 ml-1"/>
          </Button>
        </div>
      </div>

      <div className="space-y-12 pb-12">
        {/* 1. Profile Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 pb-10 border-b border-border/50">
          <div className="md:col-span-1 space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {t('settings.profile', 'Kişisel Bilgiler')}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Adınız ve iletişim bilgileriniz genel profilinizi oluşturur. Fatura bilgileriniz için e-posta adresiniz temel kimliğinizdir.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-card border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('settings.fullName', 'Ad Soyad')}</Label>
                <div className="relative relative-group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Adınız Soyadınız"
                    className="pl-10 bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('settings.email', 'E-Posta Adresi')}</Label>
                <div className="relative opacity-70">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="pl-10 cursor-not-allowed bg-muted"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground pl-1">{t('settings.emailReadOnly', 'E-posta adresi hesap güvenliği nedeniyle değiştirilemez.')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('settings.phone', 'Telefon Numarası')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formatPhoneForDisplay(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="05XX XXX XX XX"
                    className="pl-10 bg-background"
                    maxLength={13}
                  />
                </div>
              </div>

              {(profileError || profileSuccess) && (
                <div className={`p-4 rounded-xl text-sm flex items-start gap-3 ${profileError ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>
                  {profileSuccess ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span className="font-medium">{profileError || t('settings.profileUpdated', 'Profiliniz başarıyla kaydedildi.')}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full sm:w-auto min-w-[140px]">
                  {isSavingProfile ? (
                    <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {t('settings.save', 'Değişiklikleri Kaydet')}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Security Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 pb-10 border-b border-border/50">
          <div className="md:col-span-1 space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {t('settings.security', 'Hesap Güvenliği')}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hesabınıza yetkisiz erişimleri engellemek için güçlü bir şifre kullanın. En az 6 karakterlik alfasayısal bir kombinasyon önerilir.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-card border rounded-2xl p-6 sm:p-8 shadow-sm">
              <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('settings.currentPassword', 'Mevcut Şifreniz')}</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('settings.newPassword', 'Yeni Şifre')}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('settings.confirmPassword', 'Yeni Şifre (Tekrar)')}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-background"
                    />
                  </div>
                </div>

                {(passwordError || passwordSuccess) && (
                  <div className={`p-4 rounded-xl text-sm flex items-start gap-3 ${passwordError ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>
                    {passwordSuccess ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <span className="font-medium">{passwordError || t('settings.passwordChanged', 'Şifreniz güvenli bir şekilde güncellendi.')}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <Button type="submit" variant="secondary" disabled={isChangingPassword} className="w-full sm:w-auto min-w-[140px]">
                    {isChangingPassword ? (
                      <span className="w-4 h-4 border-2 border-foreground/30 border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Lock className="w-4 h-4 mr-2" />
                    )}
                    {t('settings.updatePassword', 'Şifreyi Güncelle')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* 3. Preferences Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 pb-10 border-b border-border/50">
          <div className="md:col-span-1 space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              {t('settings.preferences', 'Uygulama Tercihleri')}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Kullanıcı arayüzü dilini ve bölgesel formatları belirleyin. Bu ayar tarayıcınızda hatırlanır.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-card border rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="max-w-xs space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('settings.language', 'Arayüz Dili')}</Label>
                <Select value={i18n.language} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tr">Türkçe (TR)</SelectItem>
                    <SelectItem value="en">English (US)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Danger Zone */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 pt-4">
          <div className="md:col-span-1 space-y-3">
            <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('settings.dangerZone', 'Tehlikeli Alan')}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hesabınızı ve verilerinizi kalıcı sistemsel durumlarına çekebileceğiniz kurtarılamaz işlemler.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-card border border-destructive/20 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{t('settings.deleteAccount', 'Hesabı Kapat')}</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {t('settings.deleteWarning', 'Hesabınızı sildiğinizde geçerli tüm oturumlarınız kapatılır ve profil verileriniz izole edilir. Bu işlem geri döndürülemez.')}
                </p>
              </div>
              <Button
                variant="destructive"
                className="shrink-0 w-full sm:w-auto"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('settings.deleteButton', 'Hesabı Kalıcı Olarak Sil')}
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('settings.deleteConfirmTitle', 'Emin misiniz?')}
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              {t('settings.deleteConfirmDesc', 'Bu işlem hesabınızı kapatacak ve aktif oturumunuzu sonlandıracaktır. Devam etmek istediğinize emin misiniz?')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              {t('common.cancel', 'Vazgeç')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              {isDeleting ? (
                <span className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {t('settings.deleteButton', 'Evet, Hesabımı Sil')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
