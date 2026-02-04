# LeadHunter UI Revisions – V1

Bu doküman LeadHunter frontend uygulamasında yapılacak **UI/UX ve davranışsal düzeltmeleri** tanımlar.  
Amaç: Ürünü sadeleştirmek, kullanıcıyı yormayan ve anlaşılır bir arayüz elde etmek.

Kurallar:
- Backend’e DOKUNULMAYACAK (şimdilik).
- Mevcut çalışan akışlar bozulmayacak.
- Değişiklikler **adım adım**, her biri ayrı PR / ayrı prompt olarak yapılacak.
- Tahminle özellik eklenmeyecek.

---

## 1. Header / Profil / Kredi Yönetimi (P0)

### 1.1 Kredi Göstergesi
- Sidebar’ın en altında bulunan:
  - mevcut kredi miktarı
  - “kredi satın al” butonu  
  **tamamen kaldırılacak**.
- Bunun yerine:
  - Header alanında, **profil adının solunda**
    - `Kredi: {mevcut_kredi}` şeklinde bir gösterim olacak
    - yanında **“Kredi Satın Al”** butonu olacak
- “Kredi Satın Al” butonu kullanıcıyı mevcut billing/satın alma sayfasına yönlendirmeli.

### 1.2 Kredi Anlık Güncellenme
- Kredi miktarı:
  - sayfa yenilenince değil
  - sayfa geçişinde değil
  - **her kredi kullanımında anında** UI’da değişmeli
- Search veya kredi tüketen herhangi bir aksiyon:
  - kredi düşümünü **optimistic olarak** UI’da göstermeli
  - API başarısız olursa eski değere geri dönmeli
- Kredi için tek bir global state kullanılmalı (context/store).

### 1.3 Search Sayfasındaki Kredi Bilgisi
- Arama sonuçları ekranında görünen:
  - “kalan kredi” bilgisi **tamamen kaldırılacak**.

---

## 2. Profil Alanı Düzenlemeleri (P0)

### 2.1 Dil Seçimi
- Profil dropdown içinde bulunan **dil seçimi**:
  - dropdown’ın içinden çıkarılacak
  - profil alanının **sağ tarafında**, ayrı bir kontrol olarak gösterilecek

### 2.2 Profil Dropdown İçeriği
- Profil dropdown menüsünde:
  - **Ayarlar (Settings)** seçeneği bulunmalı
  - Ayarlar sayfasına yönlendirmeli

---

## 3. Search (Arama) Sayfası Sadeleştirme (P0)

### 3.1 Kaldırılacak Alanlar
Search ekranından tamamen kaldırılacak:
- “Kayıtlı filtreler” alanı
- Sonuç tablosundaki:
  - “Güvenli veri” ibaresi
  - “CSV indir” butonu
  - “Cache: Bilinmiyor”
  - “Tahmini Maliyet: 0”
  - “Tazelik: Bilinmiyor”
- Arama ekranındaki **Enrich** butonu ve açılan modal

### 3.2 Email & Sosyal Bilgi Gösterimi (Search Results)
- Arama sonuç tablosunda:
  - **E-posta** için ayrı bir kolon olacak
    - Değer: `Bulundu` / `Yok` (veya benzeri sade ifade)
  - **Sosyal Profiller** için ayrı bir kolon olacak
    - Örn: `3 profil bulundu`, `Bulundu`, `Yok`
- Detaylı sosyal profil ve email bilgileri:
  - **Search ekranında gösterilmeyecek**
  - Lead List detay ekranına bırakılacak

### 3.3 Lead Detay Sidebar (Search)
- “Detay” butonuna basınca açılan sidebar/modal içinde:
  - adres
  - website
  - telefon
  - puan
  - yorum
  - çalışma saatleri  
  **kalacak**
- Ek olarak sadece:
  - E-posta: `Var / Yok`
  - Sosyal Profiller: `Var / Yok`
  gösterilecek
- Detaylı sosyal/email bilgisi burada olmayacak.

### 3.4 Listeye Ekleme
- “Seçilenleri ekle” butonunun adı:
  - **“Seçilenleri Listeye Ekle”** olarak değiştirilecek
- Eğer kullanıcı daha önce liste oluşturmadıysa:
  - Bu modal içinde **yeni liste oluşturma** seçeneği olacak
  - Oluşturulan listeye seçilen lead’ler eklenebilecek

---

## 4. Lists (Lead Listeleri) (P1)

### 4.1 Liste Yönetimi
- Kullanıcı:
  - Liste adını düzenleyebilmeli
  - Listeyi silebilmeli
- Liste detay ekranındaki:
  - Üst kısımdaki genel “etiket alanı” kaldırılacak (gereksiz)

### 4.2 Liste Sonuç Tablosu
- “Skor” alanı:
  - kaldırılacak veya
  - kullanıcıya anlamlı bir isimle değiştirilecek
- “Pipeline” alanı:
  - kaldırılacak
- “Not” kolonu:
  - inline düzenlenebilir
  - placeholder’lı metin alanı gibi çalışmalı
- “Etiketler” kolonu:
  - inline düzenlenebilir
- Eksik olan kolonlar eklenecek:
  - Sosyal Profiller
  - Adres

### 4.3 Email & Sosyal Profiller (List)
- Email ve sosyal profil kolonlarında:
  - Eğer veri yoksa
    - kullanıcıyı “detay tamamlamaya” yönlendiren bir CTA
    - neden gerekli olduğunu açıklayan kısa bir metin olmalı

### 4.4 Filtreleme & Export
- Liste sonuçlarında filtreleme:
  - Website var / yok
  - Email var / yok
  - Telefon var / yok
- Filtrelenmiş sonuçlar üzerinden:
  - Export yapılabilmeli
  - CSV / Excel
  - (ileride HubSpot / Pipedrive opsiyonel)

---

## 5. Billing (Ödeme) (P1)

### 5.1 Ödeme Yöntemi Seçimi
- Satın al butonundan sonra açılan ödeme yöntemi ekranı:
  - tamamen yenilenecek
- Sadece şu ödeme yöntemleri olacak:
  - Kredi / Banka Kartı
  - Hesaba Havale
- Sanal POS sağlayıcı isimleri (iyzico, paytr vb.) **kullanıcıya gösterilmeyecek**

### 5.2 Paket Kartları
- Paket kartları kalacak
- Paketlerin içinde:
  - açıklayıcı bilgiler eklenecek (kredi miktarı, kullanım senaryosu vb.)

---

## 6. Settings (Ayarlar) (P2)

- Profil
- Şifre değiştir
- Dil
- Hesap silme

Bu bölümler:
- alt alta tek kolon yerine
- **iki kutulu**, sade ve modern bir layout ile gösteri
