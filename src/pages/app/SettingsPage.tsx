import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Lock, LogOut, Save, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Ahmet Yılmaz");
  const [email, setEmail] = useState("ahmet@sirket.com");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      {/* Profile */}
      <div className="bg-card rounded-xl border shadow-soft p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <User className="w-5 h-5" />
          Profil Bilgileri
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ad Soyad</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Button onClick={handleSave}>
            <Save className="w-4 h-4" />
            {saved ? "Kaydedildi!" : "Değişiklikleri Kaydet"}
          </Button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-card rounded-xl border shadow-soft p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Şifre Değiştir
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Mevcut Şifre</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="currentPassword"
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Yeni Şifre</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              En az 8 karakter, bir büyük harf ve bir rakam içermelidir
            </p>
          </div>

          <Button variant="outline" onClick={handleSave}>
            Şifre Güncelle
          </Button>
        </div>
      </div>

      {/* Logout */}
      <div className="bg-card rounded-xl border shadow-soft p-6">
        <h3 className="text-lg font-semibold mb-4">Oturum</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Hesabınızdan çıkış yapın. Tüm verileriniz güvende kalacaktır.
        </p>
        <Button variant="destructive" onClick={() => setShowLogoutDialog(true)}>
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </Button>
      </div>

      {/* Logout confirmation */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Çıkış Yap</DialogTitle>
            <DialogDescription>
              Hesabınızdan çıkış yapmak istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Çıkış Yap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
