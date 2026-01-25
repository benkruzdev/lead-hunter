# LeadHunter

Türkiye odaklı B2B Lead & Prospecting SaaS ürünü. İşletme arama, lead toplama, yönetme ve dışa aktarma süreçlerini tek panelde sunar.

## 📁 Proje Yapısı (Monorepo)

```
lead-hunter/
├── api/                    # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── config/        # Supabase admin client
│   │   ├── middleware/    # Auth middleware
│   │   ├── routes/        # API endpoints
│   │   └── index.js       # Server entry point
│   ├── package.json
│   └── README.md
├── database/              # Database schema & docs
│   ├── schema.sql        # Complete database schema
│   ├── BACKEND_INTEGRATION.md
│   ├── ARCHITECTURE.md
│   └── ...
├── src/                   # Frontend (React + Vite)
│   ├── components/
│   ├── pages/
│   ├── contexts/
│   └── ...
├── DEPLOYMENT.md         # Complete deployment guide
├── PRODUCT_SPEC.md       # Product specifications (Turkish)
└── README.md             # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- (Optional) Vercel account for frontend deployment
- (Optional) Render account for backend deployment

### 1️⃣ Frontend Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_API_URL=http://localhost:3001

# Start development server
npm run dev
```

Frontend will be available at `http://localhost:5173`

### 2️⃣ Backend Setup

```bash
# Navigate to API directory
cd api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your Supabase SERVICE ROLE KEY
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# PORT=3001
# FRONTEND_URL=http://localhost:5173

# Start development server
npm run dev
```

Backend will be available at `http://localhost:3001`

### 3️⃣ Database Setup

1. Create a Supabase project
2. Go to SQL Editor
3. Copy and paste contents of `database/schema.sql`
4. Click Run

See `database/IMPLEMENTATION_CHECKLIST.md` for detailed verification steps.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md) | Complete product specifications (Turkish) |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Step-by-step deployment guide |
| [`api/README.md`](api/README.md) | Backend API documentation |
| [`database/schema.sql`](database/schema.sql) | Complete database schema |
| [`database/ARCHITECTURE.md`](database/ARCHITECTURE.md) | System architecture diagrams |
| [`database/BACKEND_INTEGRATION.md`](database/BACKEND_INTEGRATION.md) | Backend integration examples |
| [`database/QUICK_REFERENCE.md`](database/QUICK_REFERENCE.md) | Database quick reference |

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn-ui
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Auth**: Supabase Auth (client-side)
- **State**: React Query + Context API

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express
- **Database Client**: Supabase (service role)
- **Authentication**: JWT verification
- **CORS**: Configured for frontend origin

### Database
- **Platform**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Security**: Row Level Security (RLS)
- **Storage**: Supabase Storage (for exports)

---

## 🔐 Security

- **Frontend**: Uses Supabase anon key (read-only access)
- **Backend**: Uses Supabase service role key (admin access)
- **Database**: All tables have RLS policies enabled
- **Credit Operations**: Only backend can modify credits
- **Authentication**: JWT verification on all protected endpoints

See `database/ARCHITECTURE.md` for detailed security architecture.

---

## 🌍 Deployment

### Production Deployment

1. **Database**: Supabase (already hosted)
2. **Frontend**: Vercel (recommended) or Netlify
3. **Backend**: Render (recommended) or Railway

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for complete deployment instructions.

### Quick Deploy

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/lead-hunter)

After deploying frontend, deploy backend to Render and update `VITE_API_URL` in Vercel environment variables.

---

## 📊 Features

### V1 (MVP)
- ✅ User authentication (email/password + Google OAuth)
- ✅ Credit system with transaction history
- ✅ Profile management
- 🚧 Business search with filters
- 🚧 Lead lists and management
- 🚧 Search result caching (30 days)
- 🚧 CSV/Excel export

### V1.1 (Planned)
- Lead scoring (Hot/Warm/Cold)
- Lead enrichment (email, social links)
- Pipeline management
- Tags and notes

### V2 (Future)
- Team collaboration
- Advanced filtering
- Data freshness indicators
- API access

---

## 🤝 Development

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting (follows project config)

### Git Workflow

```bash
# Feature development
git checkout -b feature/your-feature
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature

# Create pull request on GitHub
```

### Testing

```bash
# Frontend tests (when available)
npm run test

# Backend tests (when available)
cd api && npm run test
```

---

## 📞 Support

- **Product Spec**: See `PRODUCT_SPEC.md` for business requirements
- **Technical Issues**: Check relevant documentation in `database/` or `api/` folders
- **Deployment Issues**: See `DEPLOYMENT.md` troubleshooting section

---

## 📄 License

Proprietary - All rights reserved

---

**Current Status**: ✅ Backend skeleton ready → Ready for Auth Module integration

**Next Steps**:
1. Configure Supabase credentials in `.env` files
2. Test backend locally: `cd api && npm run dev`
3. Test frontend locally: `npm run dev`
4. Deploy to Render (backend) and Vercel (frontend)
5. Proceed to Step 2: Frontend Auth Integration

