# LeadHunter API Server

Backend API for LeadHunter - Auth & Credit Management

## Setup

### 1. Install Dependencies

```bash
cd api
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
```

**⚠️ IMPORTANT**: Use the **Service Role Key**, NOT the anon key!

### 3. Run Locally

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:3001`

---

## API Endpoints

### Health Check

#### `GET /api/health`
Basic health check

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-01-25T19:00:00.000Z",
  "service": "LeadHunter API",
  "version": "1.0.0"
}
```

#### `GET /api/health/ready`
Readiness check (tests database connection)

**Response:**
```json
{
  "status": "READY",
  "timestamp": "2026-01-25T19:00:00.000Z",
  "database": "connected"
}
```

---

### Authentication

#### `GET /api/auth/profile`
Get current user's profile

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "profile": {
    "id": "user-uuid",
    "full_name": "John Doe",
    "phone": "05551234567",
    "plan": "solo",
    "credits": 150,
    "role": "user",
    "is_active": true,
    "email": "user@example.com",
    "created_at": "2026-01-25T19:00:00.000Z",
    "updated_at": "2026-01-25T19:00:00.000Z"
  }
}
```

#### `PATCH /api/auth/profile`
Update user's profile

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "full_name": "John Smith",
  "phone": "05559876543"
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "user-uuid",
    "full_name": "John Smith",
    "phone": "05559876543",
    ...
  }
}
```

#### `POST /api/auth/verify`
Verify JWT token

**Body:**
```json
{
  "token": "jwt-token-here"
}
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  }
}
```

---

### Credits

#### `GET /api/credits/balance`
Get current user's credit balance

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "credits": 150
}
```

#### `GET /api/credits/history?limit=50`
Get credit transaction history

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `limit` (optional): Number of transactions to return (max 100, default 50)

**Response:**
```json
{
  "transactions": [
    {
      "id": "transaction-uuid",
      "user_id": "user-uuid",
      "amount": -10,
      "type": "search_page",
      "description": "Search page 2 for session abc123",
      "created_at": "2026-01-25T19:00:00.000Z"
    },
    ...
  ]
}
```

#### `POST /api/credits/deduct`
Deduct credits from user's account

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "amount": 10,
  "type": "search_page",
  "description": "Search page 2 for session abc123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "charged": 10,
  "message": "Credits deducted successfully"
}
```

**Response (Insufficient Credits):**
```json
{
  "error": "Insufficient credits",
  "message": "You need 10 credits but don't have enough",
  "required": 10
}
```

---

## Deployment to Render

### 1. Create New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository

### 2. Configure Service

- **Name**: `leadhunter-api`
- **Environment**: `Node`
- **Root Directory**: `api`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 3. Add Environment Variables

In Render dashboard, add these environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
```

### 4. Deploy

Click **Create Web Service** and wait for deployment.

Your API will be available at: `https://leadhunter-api.onrender.com`

---

## Testing

### Test Health Check

```bash
curl https://leadhunter-api.onrender.com/api/health
```

### Test with JWT Token

```bash
# Get JWT token from Supabase Auth (frontend)
TOKEN="your-jwt-token-here"

# Get profile
curl -H "Authorization: Bearer $TOKEN" \
  https://leadhunter-api.onrender.com/api/auth/profile

# Get credits
curl -H "Authorization: Bearer $TOKEN" \
  https://leadhunter-api.onrender.com/api/credits/balance
```

---

## Project Structure

```
api/
├── src/
│   ├── config/
│   │   └── supabase.js       # Supabase admin client
│   ├── middleware/
│   │   └── auth.js            # JWT verification middleware
│   ├── routes/
│   │   ├── health.js          # Health check endpoints
│   │   ├── auth.js            # Auth endpoints
│   │   └── credits.js         # Credit endpoints
│   └── index.js               # Main server file
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

---

## Security Notes

1. **Service Role Key**: NEVER expose in frontend code or commit to git
2. **JWT Validation**: All protected endpoints verify JWT tokens
3. **RLS Bypass**: Service role key bypasses RLS - all operations are validated in backend code
4. **CORS**: Configure `FRONTEND_URL` to restrict access to your frontend only

---

## Next Steps

After deploying the backend:

1. Update frontend `.env.local` with backend API URL:
   ```env
   VITE_API_URL=https://leadhunter-api.onrender.com
   ```

2. Frontend can now call backend APIs for:
   - User profile management
   - Credit operations
   - Token verification

---

## Support

Refer to:
- `database/BACKEND_INTEGRATION.md` - Detailed integration examples
- `database/ARCHITECTURE.md` - System architecture
- `database/QUICK_REFERENCE.md` - Database schema reference
