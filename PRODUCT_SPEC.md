LeadHunter – Final Ürün Dokümanı
1. Ürün Özeti
LeadHarita; Türkiye odaklı başlayıp global ölçekte büyüyebilecek, işletme arama → lead toplama → yönetme → dışa aktarma sürecini tek panelde sunan bir B2B Lead & Prospecting SaaS ürünüdür.
Hedef kullanıcılar:
•	Dijital ajanslar
•	Satış ekipleri
•	Freelancer’lar
•	KOBİ’lere satış yapan bireysel kullanıcılar
Ürün; resmi ve yasal veri kaynakları kullanır, scraping içermez, ban/blacklist risklerini minimize edecek şekilde tasarlanmıştır.
________________________________________
2. Tasarım ve UI Kuralları (ZORUNLU)
•	Projenin mevcut GitHub reposundaki UI ve component yapısı, projenin tek tasarım ve arayüz referansıdır (single source of truth).
•	Geliştirme süreci, repo üzerinden GitHub ile eş zamanlı olarak ilerleyecektir.
•	Yeni tasarım yapılmayacak
•	Var olan:
o	Sidebar
o	Topbar
o	Table
o	Drawer / Modal
o	Badge / Chip / Button
o	Skeleton / Empty state
yapıları korunacak
Yeni özellikler, mevcut component pattern’leri genişletilerek eklenecek.
________________________________________
3. Dil Desteği
•	Türkçe (varsayılan)
•	İngilizce
Tüm metinler i18n altyapısı ile yönetilecek.
Dil seçimi:
•	Landing page
•	Uygulama içi kullanıcı menüsü
________________________________________
4. Kredi Ekonomisi (ŞEFFAF)
İşlem	Kredi
Arama başlatma	0
Yeni sonuç sayfası görüntüleme	10
Listeye lead ekleme	1 / lead
Detayları Tamamla (enrichment)	X / başarılı lead
CSV / Excel export	0
Kurallar:
•	Kullanıcı her işlemden önce kaç kredi harcanacağını görür
•	Başarısız enrichment işlemlerinde kredi düşmez
•	Daha önce açılmış sayfalar tekrar görüntülendiğinde kredi düşmez (30 gün)
________________________________________
5. Müşteri Paneli – V1
5.1 Onboarding & Auth
•	Kayıt / Giriş
•	Şifre sıfırlama
•	Google ile giriş (OAuth)
Kayıt Alanları:
•	Ad Soyad
•	Telefon (zorunlu, doğrulamasız – maske: 05xx xxx xx xx)
•	E-posta
•	Şifre
•	Captcha (register’da zorunlu)
İlk girişte rehber:
1.	Şehir seç
2.	İlçe seç
3.	Kategori yaz
4.	Ara
5.	Listeye ekle
6.	CSV indir
________________________________________
5.2 Uygulama İskeleti
•	Sol Menü:
o	Arama
o	Lead Listeleri
o	Arama Geçmişi
o	Exportlar
o	Faturalandırma
o	Ayarlar
•	Üst Bar:
o	Sayfa başlığı
o	Kalan kredi
o	Dil seçimi
o	Kullanıcı menüsü
________________________________________
5.3 Arama Sayfası
Filtreler:
•	Şehir (81 il)
•	İlçe (dinamik)
•	Kategori (serbest yazı + autocomplete + öneri chip’leri)
•	Min puan (0–5)
•	Min yorum
Sonuçlar:
•	Sayfa başına 20 kayıt
•	Toplam sonuç sayısı gösterilir
•	Pagination: 1–20 / 21–40 / 41–60
Sayfa geçişi:
•	Yeni sayfa = 10 kredi
•	Onay modalı
Aksiyonlar:
•	Seçilenleri Listeye Ekle
•	Kalan kredi badge
________________________________________
5.4 Arama Oturumları & Geçmiş
•	Her arama bir “Search Session” oluşturur
•	30 gün saklanır
•	Açılmış sayfalar ücretsiz tekrar görüntülenir
•	Açılmamış sayfalar kredi ister
UI:
•	Arama Geçmişi ekranı
•	“Devam Et” butonu
________________________________________
5.5 Lead Listeleri
•	Liste oluşturma
•	Liste kartları: isim, lead sayısı, tarih
Liste Detayı:
•	İşletme adı
•	Telefon
•	Website
•	Email (enrichment sonrası)
•	Skor (Sıcak / Ilık / Soğuk)
•	Pipeline durumu
•	Not (inline + @etiket)
Bulk işlemler:
•	Toplu etiket
•	Toplu not
•	Toplu sil
________________________________________
5.6 Lead Skoru (V1.1)
Amaç: Kullanıcıya önceliklendirme ve zaman kazancı sağlamak
Hesaplama:
•	⭐ 4.5+ puan & 200+ yorum → Sıcak
•	⭐ 4.0+ puan & 50+ yorum → Ilık
•	Diğer → Soğuk
________________________________________
5.7 Enrichment – Detayları Tamamla (V1.1)
Kaynak: İşletmenin kendi web sitesi
Bulunanlar:
•	Public email
•	Sosyal linkler (Instagram, Facebook, X, YouTube, TikTok, Linkedin vb.)
Kurallar:
•	Sadece public bilgi
•	Başarılı bulunan lead’ler ücretlendirilir
•	Bulunamazsa kredi düşmez
________________________________________
5.8 Exportlar
Formatlar:
•	CSV
•	Excel (.xlsx)
Export geçmişi:
•	Dosya adı
•	Tarih
•	Lead sayısı
•	Not
________________________________________
5.9 Faturalandırma
•	Planlar:
o	Solo
o	Team (3 kullanıcı)
Ödeme yöntemleri:
•	Manuel
•	PayTR
•	iyzico
•	Shopier
________________________________________
5.10 Ayarlar
•	Profil
•	Şifre değiştir
•	Dil
•	Hesap silme (soft delete)
________________________________________
7.	Admin Panel – V1
Admin panel için ayrı bir giriş ekranı yapılacaktır.
6.1 Güvenlik
•	Admin route gizli path (env’den)
•	Role-based access
________________________________________
6.2 Dashboard
•	Kullanıcı sayısı
•	Günlük arama
•	Günlük kredi
•	Günlük export
________________________________________
6.3 Kullanıcı Yönetimi
•	Profil
•	Plan
•	Kredi
•	Durum
•	Son giriş IP (maskeli)
________________________________________
6.4 Kredi Yönetimi
•	Ledger
•	Manuel kredi yükleme
•	Açıklama
________________________________________
6.5 Arama Logları
•	Kullanıcı
•	Şehir / kategori
•	Sonuç sayısı
•	Harcanan kredi
________________________________________
6.6 Export Yönetimi
•	Dosyalar
•	İndirme
•	Silme
________________________________________
6.7 Ödeme Yönetimi
•	Siparişler
•	Ödeme durumu
•	Kredi yükleme
________________________________________
6.8 Maliyet Paneli
•	API çağrı sayıları
•	Tahmini maliyet
•	Günlük grafikler
________________________________________
6.9 SMTP & Sistem Ayarları
•	SMTP ayarları
•	Mail test
•	Kredi kuralları
•	Plan ayarları
________________________________________
7. Yol Haritası
V1: Çekirdek
V1.1: Katma değer
V2: Data freshness, gelişmiş team
________________________________________
8. Son Not
Bu doküman, geliştirme sürecinde tek referans kabul edilir.
UI, kredi, veri ve güvenlik kuralları bu kapsamın dışına çıkamaz.
________________________________________

