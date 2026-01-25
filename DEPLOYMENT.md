# LeadHunter - Deployment Guide

Complete deployment guide for LeadHunter application (Frontend + Backend + Database).

---

## 📋 Prerequisites

- [ ] GitHub account
- [ ] Supabase account and project
- [ ] Vercel account (for frontend)
- [ ] Render account (for backend)

---

## 🗄️ Step 1: Database Setup (Supabase)

### 1.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click **New Project**
3. Fill in details:
   - Name: `leadhunter`
   - Database Password: (save this!)
   - Region: Choose closest to your users
4. Click **Create Project** and wait for provisioning

### 1.2 Run Database Schema

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy contents of `database/schema.sql`
4. Paste and click **Run**
5. Verify: Check **Table Editor** → You should see all tables

### 1.3 Get API Keys

1. Go to **Settings** → **API**
2. Copy:
   - `Project URL` (e.g., https://xyz.supabase.co)
   - `anon public` key → For frontend
   - `service_role` key → For backend (KEEP SECRET!)

---

## 🎨 Step 2: Frontend Deployment (Vercel)

### 2.1 Push to GitHub

```bash
# If not already a git repo
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Create repo on GitHub and push
git remote add origin https://github.com/YOUR_USERNAME/lead-hunter.git
git push -u origin main
```

### 2.2 Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.3 Add Environment Variables

In Vercel project settings → **Environment Variables**, add:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_URL=https://leadhunter-api.onrender.com
```

**Note**: You'll get the `VITE_API_URL` after deploying backend in Step 3.

### 2.4 Deploy

Click **Deploy** and wait for completion.

Your frontend will be live at: `https://your-project.vercel.app`

---

## 🔧 Step 3: Backend Deployment (Render)

### 3.1 Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `leadhunter-api`
   - **Environment**: `Node`
   - **Root Directory**: `api`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 3.2 Add Environment Variables

In Render service settings → **Environment**, add:

```
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
FRONTEND_URL=https://your-project.vercel.app
```

**⚠️ CRITICAL**: Use **service_role** key, NOT anon key!

### 3.3 Deploy

Click **Create Web Service** and wait for deployment.

Your backend will be live at: `https://leadhunter-api.onrender.com`

### 3.4 Update Frontend Environment

Go back to Vercel → Environment Variables and update:

```
VITE_API_URL=https://leadhunter-api.onrender.com
```

Redeploy frontend for changes to take effect.

---

## ✅ Step 4: Verification

### 4.1 Test Backend Health

```bash
curl https://leadhunter-api.onrender.com/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "...",
  "service": "LeadHunter API",
  "version": "1.0.0"
}
```

### 4.2 Test Database Connection

```bash
curl https://leadhunter-api.onrender.com/api/health/ready
```

Expected response:
```json
{
  "status": "READY",
  "timestamp": "...",
  "database": "connected"
}
```

### 4.3 Test Frontend

1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Try to register a new account
3. Check Supabase → **Authentication** → Users
4. Verify profile was created in **Table Editor** → profiles

---

## 🔄 Step 5: Continuous Deployment

### Auto-Deploy on Git Push

Both Vercel and Render are now configured for automatic deployments:

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
3. Vercel and Render will automatically deploy

### Deployment Branches

- **Frontend (Vercel)**: Deploys from `main` branch
- **Backend (Render)**: Deploys from `main` branch

---

## 📊 Monitoring

### Vercel Logs

- Go to Vercel Dashboard → Your Project → Deployments
- Click on a deployment → View Logs

### Render Logs

- Go to Render Dashboard → Your Service
- Click **Logs** tab for real-time logs

### Supabase Logs

- Go to Supabase Dashboard → Logs
- View API logs, Database logs, etc.

---

## 🐛 Troubleshooting

### Backend: "Missing script: start"

**Problem**: Render can't find start script  
**Solution**: Make sure `rootDir: api` is set in Render configuration

### Backend: Database connection failed

**Problem**: Can't connect to Supabase  
**Solution**: 
1. Check `SUPABASE_URL` is correct (with https://)
2. Check `SUPABASE_SERVICE_ROLE_KEY` is the service_role key, not anon key
3. Verify Supabase project is not paused

### Frontend: CORS errors

**Problem**: Browser blocks API requests  
**Solution**: 
1. Make sure `FRONTEND_URL` in backend .env matches your Vercel URL exactly
2. Include https:// in the URL
3. Redeploy backend after changing CORS settings

### Frontend: Can't fetch user data

**Problem**: API returns 401 Unauthorized  
**Solution**:
1. Check JWT token is being sent in Authorization header
2. Verify token is fresh (not expired)
3. Check backend logs for authentication errors

### Database: Profile not created on signup

**Problem**: User created but profile missing  
**Solution**:
1. Check trigger exists: Run verification query from `database/IMPLEMENTATION_CHECKLIST.md`
2. Check trigger function logs in Supabase
3. Verify `raw_user_meta_data` contains full_name and phone

---

## 🔐 Security Checklist

- [ ] Service role key is ONLY in backend environment variables
- [ ] Service role key is NOT committed to git
- [ ] Frontend uses anon key only
- [ ] CORS is configured with specific frontend URL (not `*`)
- [ ] Database RLS policies are enabled
- [ ] All API endpoints verify JWT tokens
- [ ] Supabase project has strong database password

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           USER'S BROWSER                        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│     FRONTEND (Vercel)                           │
│     - React + Vite                              │
│     - Supabase Client (anon key)                │
│     - Auth UI                                   │
└────────┬───────────────────────┬────────────────┘
         │                       │
         │ Auth                  │ API Calls
         │ (Direct)              │ (JWT Bearer)
         ▼                       ▼
┌─────────────────┐    ┌──────────────────────────┐
│   SUPABASE      │    │  BACKEND (Render)        │
│   - Auth        │    │  - Express API           │
│   - Database    │◄───┤  - Supabase Admin Client │
│   - Storage     │    │  - Credit Management     │
└─────────────────┘    └──────────────────────────┘
```

---

## 📚 Environment Variables Summary

### Frontend (.env.local / Vercel)
```env
VITE_SUPABASE_URL=https://xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # Anon key
VITE_API_URL=https://leadhunter-api.onrender.com
```

### Backend (api/.env / Render)
```env
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Service role key!
FRONTEND_URL=https://your-project.vercel.app
```

---

## 🚀 Next Steps

After successful deployment:

1. **Create Admin User**: 
   - Sign up via frontend
   - Manually update role to 'admin' in Supabase Table Editor

2. **Add Initial Credits**:
   ```sql
   -- In Supabase SQL Editor
   SELECT add_credits(
     'user-uuid'::uuid,
     1000,
     'manual_add',
     'Initial credits'
   );
   ```

3. **Test Complete Flow**:
   - Register new user
   - Check profile created
   - View credit balance (should be 0)
   - Admin: Add credits
   - Test credit deduction

4. **Configure Production Settings**:
   - Set up custom domain on Vercel
   - Configure email templates in Supabase
   - Set up monitoring and alerts

---

## 📞 Support

- **Frontend Issues**: Check Vercel logs
- **Backend Issues**: Check Render logs
- **Database Issues**: Check Supabase logs
- **API Documentation**: See `api/README.md`
- **Database Schema**: See `database/QUICK_REFERENCE.md`

---

**Deployment Status Checklist:**

- [ ] Supabase project created and schema applied
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Render
- [ ] All environment variables configured
- [ ] Health checks passing
- [ ] Test user registration working
- [ ] Profile auto-creation working
- [ ] Ready for Step 2: Frontend Auth Integration! 🎉
