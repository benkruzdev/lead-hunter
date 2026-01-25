import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="text-2xl font-bold">
          <span className="text-primary">Lead</span>
          <span className="text-foreground">Hunter</span>
        </Link>
        
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
            Fiyatlandırma
          </Link>
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
            Özellikler
          </a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
            İletişim
          </a>
        </div>
        
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost">Giriş Yap</Button>
          </Link>
          <Link to="/register">
            <Button>Ücretsiz Dene</Button>
          </Link>
        </div>
        
        {/* Mobile menu button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-background border-b shadow-lg animate-fade-in">
          <div className="container py-4 space-y-4">
            <Link 
              to="/pricing" 
              className="block text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Fiyatlandırma
            </Link>
            <a href="#features" className="block text-muted-foreground hover:text-foreground transition-colors">
              Özellikler
            </a>
            <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
              İletişim
            </a>
            <div className="flex gap-3 pt-4 border-t">
              <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">Giriş Yap</Button>
              </Link>
              <Link to="/register" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">Ücretsiz Dene</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
