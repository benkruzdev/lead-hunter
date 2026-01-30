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
import { User, Mail, Phone, Lock, Globe, Trash2, Save, AlertTriangle } from 'lucide-react';
import { getProfile, updateUserProfile, changeUserPassword, deleteUserAccount } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Profile state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoadingProfile(true);
        const data = await getProfile();
        setFullName(data.profile.full_name || '');
        setEmail(data.profile.email || '');
        setPhone(data.profile.phone || '');
      } catch (error: any) {
        console.error('[Settings] Failed to load profile:', error);
        setProfileError(error.message || 'Failed to load profile');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      setProfileError(null);
      setProfileSuccess(false);

      if (!fullName.trim()) {
        setProfileError(t('settings.errors.fullNameRequired'));
        return;
      }

      if (!phone.trim()) {
        setProfileError(t('settings.errors.phoneRequired'));
        return;
      }

      await updateUserProfile(fullName, phone);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error: any) {
      console.error('[Settings] Profile update failed:', error);
      setProfileError(error.message || t('settings.errors.updateFailed'));
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
        setPasswordError(t('settings.errors.allFieldsRequired'));
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError(t('settings.errors.passwordsDoNotMatch'));
        return;
      }

      if (newPassword.length < 6) {
        setPasswordError(t('settings.errors.passwordTooShort'));
        return;
      }

      await changeUserPassword(currentPassword, newPassword);

      // Clear fields on success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error: any) {
      console.error('[Settings] Password change failed:', error);
      setPasswordError(error.message || t('settings.errors.passwordChangeFailed'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await deleteUserAccount();

      // Logout and redirect
      await supabase.auth.signOut();
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

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      {/* Profile Section */}
      <div className="bg-card rounded-xl border shadow-soft p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <User className="w-5 h-5" />
          {t('settings.profile')}
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t('settings.fullName')}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('settings.fullName')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('settings.email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="pl-10 bg-muted/50 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('settings.emailReadOnly')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('settings.phone')}</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                value={formatPhoneForDisplay(phone)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setPhone(digits);
                }}
                placeholder="05XX XXX XX XX"
                className="pl-10"
                maxLength={13}
              />
            </div>
          </div>

          {profileError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              {profileError}
            </div>
          )}

          {profileSuccess && (
            <div className="bg-green-500/10 text-green-600 p-3 rounded-md text-sm">
              {t('settings.profileUpdated')}
            </div>
          )}

          <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
            <Save className="w-4 h-4" />
            {isSavingProfile ? t('common.loading') : t('settings.save')}
          </Button>
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-card rounded-xl border shadow-soft p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          {t('settings.password')}
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('settings.currentPassword')}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('settings.newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('settings.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.passwordHint')}
            </p>
          </div>

          {passwordError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="bg-green-500/10 text-green-600 p-3 rounded-md text-sm">
              {t('settings.passwordChanged')}
            </div>
          )}

          <Button onClick={handleChangePassword} disabled={isChangingPassword}>
            {isChangingPassword ? t('common.loading') : t('settings.updatePassword')}
          </Button>
        </div>
      </div>

      {/* Language Section */}
      <div className="bg-card rounded-xl border shadow-soft p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          {t('settings.language')}
        </h3>

        <div className="space-y-2">
          <Label>{t('settings.selectLanguage')}</Label>
          <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tr">Türkçe</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="bg-card rounded-xl border border-destructive/20 shadow-soft p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          {t('settings.deleteAccount')}
        </h3>
        <p className="text-muted-foreground text-sm mb-4">
          {t('settings.deleteWarning')}
        </p>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="w-4 h-4" />
          {t('settings.deleteButton')}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.deleteConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? t('common.loading') : t('settings.deleteButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
