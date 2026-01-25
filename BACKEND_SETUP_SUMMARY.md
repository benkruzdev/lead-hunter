# ✅ Backend İskeleti Tamamlandı!

Render deployment için minimal backend API hazır.

---

## 📦 Oluşturulan Dosyalar

### Backend API (`/api`)
```
api/
├── src/
│   ├── config/
│   │   └── supabase.js              # Supabase admin client (service role)
│   ├── middleware/
│   │   └── auth.js                  # JWT verification + admin check
│   ├── routes/
│   │   ├── health.js                # Health check endpoints
│   │   ├── auth.js                  # Profile & token verification
│   │   └── credits.js               # Credit balance, history, deduct
│   └── index.js                     # Express server (main entry point)
├── .env                             # Local environment variables
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── package.json                     # ✅ "start" script included
└── README.md                        # API documentation
```

### Documentation Files
```
database/                            # (Previously created)
├── schema.sql                       # ✅ With 3 revisions
├── ARCHITECTURE.md
├── BACKEND_INTEGRATION.md
├── QUICK_REFERENCE.md
└── ...

DEPLOYMENT.md                        # Complete deployment guide
render.yaml                          # Render blueprint config
README.md                            # Updated project README
```

---

## 🎯 Backend API Endpoints

### Health Check
- `GET /api/health` - Basic health check
- `GET /api/health/ready` - Database connection test

### Authentication
- `GET /api/auth/profile` - Get user profile (with email)
- `PATCH /api/auth/profile` - Update profile (name, phone)
- `POST /api/auth/verify` - Verify JWT token

### Credits
- `GET /api/credits/balance` - Get credit balance
- `GET /api/credits/history` - Get transaction history
- `POST /api/credits/deduct` - Deduct credits (secured)

**All protected endpoints require**: `Authorization: Bearer <JWT>`

---

## ✅ Render Deployment Ready

### Package.json Scripts
```json
{
  "scripts": {
    "start": "node src/index.js",        # ✅ Render uses this
    "dev": "node --watch src/index.js"   # ✅ Local development
  }
}
```

### Render Configuration (`render.yaml`)
```yaml
services:
  - type: web
    name: leadhunter-api
    env: node
    rootDir: api                          # ✅ Backend folder
    buildCommand: npm install
    startCommand: npm start               # ✅ Uses "start" script
    healthCheckPath: /api/health
```

---

## 🚀 Deployment Adımları

### 1. Local Test (Opsiyonel)

```bash
# Backend'i test et
cd api
npm install
cp .env.example .env
# .env dosyasını Supabase credentials ile doldur
npm run dev
```

**Test**: http://localhost:3001/api/health

### 2. Render'a Deploy

#### Option A: Render Dashboard (GUI)
1. [Render Dashboard](https://dashboard.render.com/) → **New +** → **Web Service**
2. GitHub reposunu bağla
3. Configure:
   - **Name**: `leadhunter-api`
   - **Environment**: Node
   - **Root Directory**: `api` ← **ÖNEMLİ**
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Environment Variables ekle:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```
5. **Create Web Service** → Deploy başlasın

#### Option B: Render Blueprint (Auto)
1. Render Dashboard → **New +** → **Blueprint**
2. Repository seç
3. `render.yaml` otomatik algılanacak
4. Environment variables manuel ekle
5. Deploy

---

## 🔐 Environment Variables

### Backend (.env / Render)
```bash
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...     # ⚠️ Service role, NOT anon!
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (.env.local / Vercel)
```bash
VITE_SUPABASE_URL=https://xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...        # ℹ️ Anon key (public)
VITE_API_URL=https://leadhunter-api.onrender.com
```

---

## ✅ Verification Checklist

### After Render Deployment

- [ ] Service deployed successfully (green status)
- [ ] Health check passing: `curl https://your-api.onrender.com/api/health`
- [ ] Database connected: `curl https://your-api.onrender.com/api/health/ready`
- [ ] Environment variables set correctly
- [ ] No "Missing script: start" error ✅

### Test API Endpoints

```bash
API_URL="https://leadhunter-api.onrender.com"

# Test health
curl $API_URL/api/health

# Test database connection
curl $API_URL/api/health/ready

# Test auth (requires JWT token from frontend)
TOKEN="your-jwt-token"
curl -H "Authorization: Bearer $TOKEN" $API_URL/api/auth/profile
```

---

## 🎨 Frontend Entegrasyonu (Sonraki Adım)

Backend deploy olduktan sonra frontend'te şöyle kullanılacak:

### 1. API Client Setup

```typescript
// src/lib/api.ts
const API_URL = import.meta.env.VITE_API_URL;

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      ...options.headers,
    },
  });
  
  return response.json();
}
```

### 2. Example: Get Credits

```typescript
// src/hooks/useCredits.ts
export function useCredits() {
  return useQuery({
    queryKey: ['credits'],
    queryFn: () => apiRequest('/api/credits/balance'),
  });
}

// Usage in component
const { data, isLoading } = useCredits();
console.log(data.credits); // 150
```

### 3. Example: Deduct Credits

```typescript
// src/api/search.ts
export async function openSearchPage(sessionId: string, page: number) {
  // Frontend shows confirmation first
  const confirmed = await confirm(`This will cost 10 credits. Continue?`);
  if (!confirmed) return;
  
  // Call backend API
  const result = await apiRequest('/api/credits/deduct', {
    method: 'POST',
    body: JSON.stringify({
      amount: 10,
      type: 'search_page',
      description: `Page ${page} of session ${sessionId}`
    })
  });
  
  if (!result.success) {
    toast.error(result.message);
    return;
  }
  
  toast.success(`10 credits deducted`);
  // Fetch search results...
}
```

---

## 📊 Architecture Flow

```
USER BROWSER
    ↓
FRONTEND (Vercel)
    ├─→ Supabase Auth (direct)        # Login/Register
    └─→ Backend API (Render)           # Credit operations
            ↓
        Supabase Admin Client
            ↓
        Database (Supabase)
```

---

## 🎯 Sorun Giderme

### ❌ "Missing script: start"
**Neden**: Render backend klasörünü bulamıyor  
**Çözüm**: Render'da **Root Directory** = `api` olmalı ✅

### ❌ "Cannot find module"
**Neden**: Dependencies yüklenmemiş  
**Çözüm**: Build Command = `npm install` ✅

### ❌ "Database connection failed"
**Neden**: Supabase credentials yanlış  
**Çözüm**: 
1. `SUPABASE_URL` https:// ile başlamalı
2. `SUPABASE_SERVICE_ROLE_KEY` kontrol et (anon değil!)

### ❌ CORS error
**Neden**: `FRONTEND_URL` yanlış  
**Çözüm**: Vercel URL'ini tam olarak kopyala (https:// dahil)

---

## 📝 Next Steps

### Step 2: Frontend Auth Integration

Artık backend hazır, şimdi frontend'te:

1. ✅ API client setup
2. ✅ Credit display component
3. ✅ Profile management
4. ✅ Credit history view
5. ✅ Search page with credit deduction
6. ✅ Lead list management

See `DEPLOYMENT.md` for complete integration guide.

---

## 🎉 Özet

| Item | Status |
|------|--------|
| SQL Schema | ✅ With 3 revisions |
| Backend API | ✅ Express + Supabase |
| "start" script | ✅ In package.json |
| Render Config | ✅ render.yaml ready |
| Documentation | ✅ Complete |
| Local Test | ⏳ Ready to test |
| Deploy to Render | ⏳ Ready to deploy |
| Frontend Integration | ⏳ Next step |

**Backend iskelet hazır! Artık Render'a deploy edilebilir. 🚀**

**Şimdi yapılacaklar**:
1. Supabase credentials'ları `api/.env` dosyasına ekle
2. Local test: `cd api && npm run dev`
3. Render'a deploy et
4. Step 2: Frontend Auth Integration'a geç
