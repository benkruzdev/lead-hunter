import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { User, Mail, Phone, Lock, Globe, Trash2, Save, AlertTriangle, Shield, CreditCard, ArrowRight, Zap, CheckCircle2, FileDown, Bell, PauseCircle } from 'lucide-react';
import { updateAccountProfile, changeUserPassword, requestAccountSoftDelete, requestAccountDeactivate, updateAccountPreferences } from '@/lib/api';
import { ACTIVE_COUNTRIES } from '@/config/countries';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer } from '@/components/shared/PageContainer';
import { PageHeader } from '@/components/shared/PageHeader';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Safe frontend data-flow cleanup: rely solely on canonical account, avoiding isolated page state
  const { account, credits, refreshProfile, signOut, loading: authLoading } = useAuth();

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Sync internal form when context account loads or changes
  useEffect(() => {
    if (account) {
      setFullName(account.full_name || '');
      setPhone(account.phone || '');
    }
  }, [account]);

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

  // Deactivate Account State
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handlePreferenceToggle = async (key: string, value: boolean) => {
    try {
      await updateAccountPreferences({ [key]: value });
      await refreshProfile();
    } catch (err) {
      console.error(`[Settings] Failed toggling ${key}:`, err);
    }
  };

  const handlePreferenceSelect = async (key: string, value: string) => {
    try {
      if (key === 'language') i18n.changeLanguage(value);
      await updateAccountPreferences({ [key]: value });
      await refreshProfile();
    } catch (err) {
      console.error(`[Settings] Failed updating ${key}:`, err);
    }
  };

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

      await updateAccountProfile({ full_name: fullName, phone });
      
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
      await requestAccountSoftDelete();
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

  const handleDeactivateAccount = async () => {
    try {
      setIsDeactivating(true);
      await requestAccountDeactivate();
      await signOut();
      navigate('/login');
    } catch (error: any) {
      console.error('[Settings] Account deactivation failed:', error);
      alert(error.message || 'Failed to pause account');
    } finally {
      setIsDeactivating(false);
      setShowDeactivateDialog(false);
    }
  };

  const formatPhoneForDisplay = (phoneDigits: string) => {
    if (!phoneDigits) return '';
    const cleaned = phoneDigits.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)}`;
    }
    return phoneDigits;
  };

  if (authLoading && !account) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initial = account?.full_name?.charAt(0).toUpperCase() || account?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <PageContainer maxWidth="2xl">
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
            <h2 className="text-xl font-bold text-foreground truncate">{account?.full_name || t('settings.anonymous', 'İsimsiz Kullanıcı')}</h2>
            <div className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
              <div className="flex items-center gap-1.5 shrink-0"><Mail className="w-3.5 h-3.5"/> <span className="truncate">{account?.email || '—'}</span></div>
              <div className="flex items-center gap-1.5 shrink-0"><Phone className="w-3.5 h-3.5"/> <span>{formatPhoneForDisplay(account?.phone || '') || '—'}</span></div>
            </div>
          </div>
        </div>
        
        {/* Billing/Credits Shortcut */}
        <div className="flex flex-col items-center sm:items-end gap-1.5 bg-background sm:bg-transparent w-full sm:w-auto p-4 sm:p-0 rounded-xl sm:rounded-none border sm:border-none">
          <div className="text-xs font-semibold text-muted-foreground tracking-wider">{t('dashboard.creditsRemaining', 'Kalan Krediniz')}</div>
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
                <Label htmlFor="fullName" className="text-xs font-bold tracking-wide text-muted-foreground">{t('settings.fullName', 'Ad Soyad')}</Label>
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
                <Label htmlFor="email" className="text-xs font-bold tracking-wide text-muted-foreground">{t('settings.email', 'E-Posta Adresi')}</Label>
                <div className="relative opacity-70">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={account?.email || ''}
                    disabled
                    className="pl-10 cursor-not-allowed bg-muted"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground pl-1">{t('settings.emailReadOnly', 'E-posta adresi hesap güvenliği nedeniyle değiştirilemez.')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold tracking-wide text-muted-foreground">{t('settings.phone', 'Telefon Numarası')}</Label>
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
                  <Label htmlFor="currentPassword" className="text-xs font-bold tracking-wide text-muted-foreground">{t('settings.currentPassword', 'Mevcut Şifreniz')}</Label>
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
                    <Label htmlFor="newPassword" className="text-xs font-bold tracking-wide text-muted-foreground">{t('settings.newPassword', 'Yeni Şifre')}</Label>
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
                    <Label htmlFor="confirmPassword" className="text-xs font-bold tracking-wide text-muted-foreground">{t('settings.confirmPassword', 'Yeni Şifre (Tekrar)')}</Label>
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
              Global platform davranışınızı ve varsayılan bölgesel ayarlarınızı buradan yapılandırabilirsiniz.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-card border rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold tracking-wide text-muted-foreground">{t('settings.language', 'Arayüz Dili')}</Label>
                  <Select value={account?.preferences?.language || i18n.language} onValueChange={async (val) => await handlePreferenceSelect('language', val)}>
                    <SelectTrigger className="bg-background h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tr">Türkçe (TR)</SelectItem>
                      <SelectItem value="en">English (US)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold tracking-wide text-muted-foreground">{t('settings.defaultCountry', 'Varsayılan Hedef Ülke')}</Label>
                  <Select value={account?.preferences?.default_search_country || 'TR'} onValueChange={async (val) => await handlePreferenceSelect('default_search_country', val)}>
                    <SelectTrigger className="bg-background h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVE_COUNTRIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold mb-4 text-foreground">
                  <FileDown className="w-4 h-4 text-primary" />
                  Dışa Aktarım Varsayılanları
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold tracking-wide text-muted-foreground">Varsayılan Format</Label>
                    <Select value={account?.preferences?.default_export_format || 'xlsx'} onValueChange={async (val) => await handlePreferenceSelect('default_export_format', val)}>
                      <SelectTrigger className="bg-background h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                        <SelectItem value="csv">CSV (.csv)</SelectItem>
                        <SelectItem value="gsheets">Google Sheets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold tracking-wide text-muted-foreground">Varsayılan Kapsam</Label>
                    <Select value={account?.preferences?.default_export_scope || 'full'} onValueChange={async (val) => await handlePreferenceSelect('default_export_scope', val)}>
                      <SelectTrigger className="bg-background h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Tam Karakteristik (Tüm Sütunlar)</SelectItem>
                        <SelectItem value="compact">Kompakt (Sadece İletişim)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Notifications Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 pb-10 border-b border-border/50">
          <div className="md:col-span-1 space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              {t('settings.notifications', 'Bildirim Sistemi')}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sistem uyarılarını ve bülten haberlerini yapılandırın. Kritik güvenlik mailleri her zaman gönderilir.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-card border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              
              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Bakiye Uyarı Sistemi</Label>
                  <p className="text-xs text-muted-foreground">Krediniz belirlediğiniz eşiğin altına düşünce e-posta alırsınız.</p>
                </div>
                <Switch 
                  checked={account?.preferences?.low_credit_warning_enabled ?? true} 
                  onCheckedChange={(checked) => handlePreferenceToggle('low_credit_warning_enabled', checked)}
                />
              </div>

              {account?.preferences?.low_credit_warning_enabled && (
                <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-xl -mt-2">
                  <Label className="text-sm font-medium w-32 shrink-0">Uyarı Eşiği</Label>
                  <Input 
                    type="number"
                    min="0"
                    step="100"
                    className="w-32 bg-background"
                    value={account?.preferences?.low_credit_warning_threshold ?? 100}
                    onBlur={(e) => handlePreferenceSelect('low_credit_warning_threshold', e.target.value)}
                    onChange={() => {}} // Controlled strictly via blur to avoid heavy un-debounced syncs
                  />
                  <span className="text-xs text-muted-foreground">Kredi</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Sistem Bildirimleri</Label>
                  <p className="text-xs text-muted-foreground">Dışa aktarım tamamlanmaları ve fatura özetleri.</p>
                </div>
                <Switch 
                  checked={account?.preferences?.notifications_email_enabled ?? true} 
                  onCheckedChange={(checked) => handlePreferenceToggle('notifications_email_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Platform Güncellemeleri</Label>
                  <p className="text-xs text-muted-foreground">Yeni ülkeler, özellikler ve verimlilik bültenleri.</p>
                </div>
                <Switch 
                  checked={account?.preferences?.product_updates_email_enabled ?? true} 
                  onCheckedChange={(checked) => handlePreferenceToggle('product_updates_email_enabled', checked)}
                />
              </div>

            </div>
          </div>
        </section>

        {/* 5. Lifecycle / Danger Zone */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 pt-4">
          <div className="md:col-span-1 space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Hesap Durumu
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hesabınızı geçici olarak askıya alabilir veya kalıcı olarak kapatma sürecini başlatabilirsiniz. Tüm aktif oturumlarınız sonlanır.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col gap-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b">
                <div className="space-y-1 pr-4">
                  <p className="font-semibold text-foreground flex items-center gap-2">
                    <PauseCircle className="w-4 h-4 text-muted-foreground" />
                    Hesabımı Dondur (Deaktif)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Görünürlüğünüz kilitlenir ancak verileriniz korunur. Tekrar giriş yaptığınızda hesabınız otomatik olarak aktifleşir.
                  </p>
                </div>
                <Button variant="secondary" className="shrink-0" onClick={() => setShowDeactivateDialog(true)}>
                  Hesabı Dondur
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 pr-4">
                  <p className="font-semibold text-destructive flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Hesabı Kapat (Soft Delete)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Hesabınızın operasyonel erişimi sonlandırılır ve verileriniz gizlenir. Operasyon merkezinde tamamen askıya alınmış olarak görünürsünüz.
                  </p>
                </div>
                <Button variant="destructive" className="shrink-0" onClick={() => setShowDeleteDialog(true)}>
                  Hesabı Kapat
                </Button>
              </div>

            </div>
          </div>
        </section>
      </div>

      {/* Deactivate Account Confirmation Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="w-5 h-5" />
              Hesabınız Dondurulacak
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              Hesabınızı geçici süreliğine deaktif etmek üzeresiniz. Oturumunuz tamamen sonlandırılacaktır. Tekrar kullanmak istediğinizde şifrenizle giriş yapmanız yeterlidir. Onaylıyor musunuz?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={() => setShowDeactivateDialog(false)} disabled={isDeactivating} className="w-full sm:w-auto">
              Vazgeç
            </Button>
            <Button variant="secondary" onClick={handleDeactivateAccount} disabled={isDeactivating} className="w-full sm:w-auto">
              {isDeactivating ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" /> : <PauseCircle className="w-4 h-4 mr-2" />}
              Hesabımı Dondur
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Hesap Kapatma Sürecini Başlat
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              Bu işlem hesabınızı kalıcı kapatma durumuna çeker ("Soft Delete"). Oturumunuz kapatılacaktır ve uygulamayı bir daha kullanamazsınız. Açık faturalarınız veya iade gerektiren durumlar varsa müşteri hizmetleri ile temasa geçebilirsiniz. Devam edilsin mi?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting} className="w-full sm:w-auto">
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting} className="w-full sm:w-auto">
              {isDeleting ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Evet, Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
