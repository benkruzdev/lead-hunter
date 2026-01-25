# Database Schema - LeadHunter

## Revisions Applied

### ✅ Revision #1: Plan Default Changed to 'solo'
**Previous**: `plan TEXT NOT NULL DEFAULT 'free'`  
**Current**: `plan TEXT NOT NULL DEFAULT 'solo'`

**Reason**: PRODUCT_SPEC.md defines only two plans: **Solo** and **Team**. Having 'free' as default introduces an undefined plan type that doesn't align with the product specification.

---

### ✅ Revision #2: Email Field Removed from Profiles
**Previous**: `email TEXT NOT NULL`  
**Current**: Email field completely removed

**Reason**: 
- Email already exists in `auth.users` table
- Prevents OAuth edge-case issues during profile insert
- Reduces data duplication
- When email is needed, use JOIN with `auth.users`:

```sql
SELECT p.*, u.email 
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.id = auth.uid();
```

---

### ✅ Revision #3: Credit Functions - Backend Only
**Functions**: `deduct_credits()` and `add_credits()`

**⚠️ CRITICAL SECURITY NOTE**:
These functions are marked as `SECURITY DEFINER`, which means they bypass Row Level Security (RLS) policies.

**Rules**:
- ❌ **Frontend MUST NOT call these functions directly**
- ✅ **Backend (Render service) ONLY** should call these functions using Supabase service role key
- ✅ All credit operations should be validated and authorized on backend before calling these functions

**Why**:
- Prevents potential security risks from incorrect RLS policies
- Ensures credit operations are properly validated
- Centralized credit management on backend

---

## How to Apply This Schema

### Option 1: Supabase Dashboard SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `schema.sql`
5. Click **Run**

### Option 2: Supabase CLI
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run the migration
supabase db push
```

### Option 3: Manual Migration File
```bash
# Create a new migration in your Supabase project
supabase migration new initial_schema

# Copy schema.sql contents to the new migration file
# Then apply it:
supabase db reset
```

---

## Database Structure Overview

### Core Tables
1. **profiles** - User profiles and account info
2. **credit_ledger** - Credit transaction history
3. **search_sessions** - Cached search results (30-day expiry)
4. **lead_lists** - User-created lead collections
5. **leads** - Individual lead records
6. **exports** - Export history

### Key Features
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Automatic profile creation on user signup
- ✅ Credit ledger for full transaction history
- ✅ Search result caching (30 days)
- ✅ Admin role support

---

## Next Steps

After applying this schema, proceed to **Step 2: Frontend Setup** which will include:
- Supabase client configuration
- Authentication flow
- Credit display and management
- Profile management

---

## Questions?
Refer to `PRODUCT_SPEC.md` for product requirements and business logic.
