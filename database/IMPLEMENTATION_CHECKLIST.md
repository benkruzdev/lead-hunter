# Step 1 SQL - Implementation Checklist

Use this checklist to apply and verify the revised database schema.

---

## Pre-Implementation

### [ ] 1. Backup Existing Data (If Applicable)
If you have an existing Supabase setup:

```bash
# Export existing data via Supabase dashboard
# Settings → Database → Backups → Create Backup
```

Or use Supabase CLI:
```bash
supabase db dump -f backup_$(date +%Y%m%d).sql
```

### [ ] 2. Review Files
- [ ] Read `database/REVISIONS_SUMMARY.md` - Understand the 3 changes
- [ ] Read `database/schema.sql` - Main schema file
- [ ] Read `database/ARCHITECTURE.md` - Understand security model

---

## Implementation

### Option A: Fresh Installation ✨

#### [ ] 1. Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New query**

#### [ ] 2. Run Schema
1. Copy contents of `database/schema.sql`
2. Paste into SQL Editor
3. Click **Run** (or press Ctrl+Enter)

#### [ ] 3. Verify Execution
Check for:
- [ ] Green success message
- [ ] No red error messages
- [ ] Execution time displayed

---

### Option B: Update Existing Installation 🔄

#### [ ] 1. Open Supabase SQL Editor
Same as Option A

#### [ ] 2. Run Migration
1. Copy contents of `database/migration_revisions.sql`
2. Paste into SQL Editor
3. Click **Run**

#### [ ] 3. Run Verification Queries
Copy and run each verification query from the migration file:

```sql
-- Verify plan values
SELECT plan, COUNT(*) 
FROM public.profiles 
GROUP BY plan;
```
**Expected**: Only 'solo' and 'team' values

```sql
-- Verify email column is removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'email';
```
**Expected**: No rows returned

```sql
-- Verify function comments
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('deduct_credits', 'add_credits');
```
**Expected**: Both functions exist

---

## Post-Implementation Verification

### [ ] 1. Verify Table Creation

Run this query:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected tables**:
- [ ] profiles
- [ ] credit_ledger
- [ ] search_sessions
- [ ] lead_lists
- [ ] leads
- [ ] exports

### [ ] 2. Verify RLS is Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Expected**: All tables should have `rowsecurity = true`

### [ ] 3. Verify Trigger

```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

**Expected**: `on_auth_user_created` trigger on `users` table

### [ ] 4. Verify Functions

```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('deduct_credits', 'add_credits', 'handle_new_user');
```

**Expected**: All 3 functions exist

### [ ] 5. Verify Profiles Table Structure

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;
```

**Expected columns**:
- [ ] id (uuid, not null)
- [ ] full_name (text, nullable)
- [ ] phone (text, nullable)
- [ ] plan (text, default 'solo', not null) ← **CHECK THIS**
- [ ] credits (integer, default 0, not null)
- [ ] role (text, default 'user', not null)
- [ ] is_active (boolean, default true, not null)
- [ ] created_at (timestamp, default now(), not null)
- [ ] updated_at (timestamp, default now(), not null)

**NOT EXPECTED**:
- ❌ email column (should be removed) ← **VERIFY THIS**

### [ ] 6. Verify Plan Constraint

```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name LIKE '%plan%';
```

**Expected**: `plan IN ('solo', 'team')` (NOT 'free') ← **CHECK THIS**

### [ ] 7. Test Profile Creation

Create a test user via Supabase Auth dashboard or:

```sql
-- This simulates what happens when a user signs up
-- (You can't directly INSERT into auth.users, so create via Auth UI)
```

After creating a test user, verify profile was auto-created:

```sql
SELECT id, full_name, phone, plan, credits, role
FROM profiles
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
- [ ] Profile exists for the new user
- [ ] plan = 'solo' ← **CHECK THIS**
- [ ] credits = 0
- [ ] role = 'user'
- [ ] created_at is recent

### [ ] 8. Test Credit Functions

**IMPORTANT**: Use Supabase Service Role Key for this test

```sql
-- Get a test user ID first
SELECT id FROM profiles LIMIT 1;
-- Copy the UUID

-- Test add_credits
SELECT add_credits(
  '<paste user UUID here>'::uuid,
  100,
  'manual_add',
  'Test credit addition'
);

-- Verify credit was added
SELECT credits FROM profiles WHERE id = '<paste user UUID here>';
-- Expected: 100

-- Test deduct_credits (should succeed)
SELECT deduct_credits(
  '<paste user UUID here>'::uuid,
  50,
  'search_page',
  'Test credit deduction'
);
-- Expected: true

-- Verify credit was deducted
SELECT credits FROM profiles WHERE id = '<paste user UUID here>';
-- Expected: 50

-- Test deduct_credits (should fail - insufficient)
SELECT deduct_credits(
  '<paste user UUID here>'::uuid,
  100,
  'search_page',
  'Test insufficient credits'
);
-- Expected: false

-- Verify credits unchanged
SELECT credits FROM profiles WHERE id = '<paste user UUID here>';
-- Expected: Still 50

-- Verify credit ledger
SELECT * FROM credit_ledger 
WHERE user_id = '<paste user UUID here>'
ORDER BY created_at DESC;
-- Expected: 3 records
--   1. +100 (manual_add)
--   2. -50 (search_page) 
--   3. Nothing for the failed deduction
```

### [ ] 9. Test RLS Policies

#### Test as Regular User:

1. Go to Supabase → Authentication → Users
2. Copy a test user's JWT token or create a new user
3. In SQL Editor, run:

```sql
-- Set the user's JWT (simulates authenticated user)
-- This won't work in SQL Editor, but you can test via frontend

-- Alternative: Test via Supabase client in frontend
const { data } = await supabase
  .from('profiles')
  .select('credits')
  .single();

console.log(data.credits); // Should work ✓

// Try to update credits (should fail)
const { error } = await supabase
  .from('profiles')
  .update({ credits: 999999 })
  .eq('id', userId);

console.log(error); // Should have RLS violation ✓

// Try to view other user's profile (should fail)
const { data } = await supabase
  .from('profiles')
  .select('*')
  .neq('id', userId);

console.log(data); // Should be empty or error ✓
```

---

## Environment Setup

### [ ] 1. Update .env.local (Frontend)

```bash
# c:\lead-hunter\.env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...  # Anon key
```

### [ ] 2. Create .env (Backend - when implementing)

```bash
# Backend .env (Render)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # Service role key (NOT anon key!)
```

**⚠️ CRITICAL**: Never commit service role key to git!

### [ ] 3. Verify Keys

In Supabase Dashboard:
1. Settings → API
2. Copy **anon public** key → Frontend .env.local
3. Copy **service_role** key → Backend .env (KEEP SECRET!)

---

## Smoke Test Checklist

### [ ] Can create a new user
- Via Supabase Auth UI or signup form
- Profile auto-created with plan='solo', credits=0

### [ ] Can add credits (via SQL/service role)
- Use `add_credits` function
- Verify credits increased
- Verify ledger entry created

### [ ] Can deduct credits (via SQL/service role)
- Use `deduct_credits` function
- Verify credits decreased
- Verify ledger entry created

### [ ] Cannot deduct more credits than available
- `deduct_credits` returns false
- Credits unchanged
- No ledger entry created

### [ ] RLS works for profiles
- Users can view own profile
- Users cannot view others' profiles
- Users cannot modify credits directly

### [ ] Email not in profiles
- Email column does not exist
- Email accessible via auth.users JOIN

### [ ] Plan defaults to 'solo'
- New users have plan='solo'
- Only 'solo' and 'team' values allowed
- No 'free' plans exist

---

## Troubleshooting

### ❌ Error: "column email does not exist"
**Solution**: The migration worked! This is expected after Revision #2. Update any code that references profiles.email to JOIN with auth.users instead.

### ❌ Error: "new row for relation profiles violates check constraint"
**Solution**: Make sure you're only using 'solo' or 'team' for plan values.

### ❌ Error: "permission denied for function deduct_credits"
**Solution**: You're trying to call the function from frontend. These functions should only be called from backend with service role key.

### ❌ Trigger not creating profiles
**Solution**: 
1. Verify trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`
2. Check function exists: `SELECT * FROM information_schema.routines WHERE routine_name = 'handle_new_user';`
3. Re-run the trigger creation SQL from schema.sql

### ❌ RLS blocking all operations
**Solution**: Make sure user is authenticated. RLS policies require `auth.uid()` to work. Check JWT token is valid.

---

## Rollback Plan

If you need to rollback to the old schema:

### [ ] Run Rollback Script

```sql
-- Add email column back
ALTER TABLE public.profiles
ADD COLUMN email TEXT;

-- Update with emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- Make email NOT NULL
ALTER TABLE public.profiles
ALTER COLUMN email SET NOT NULL;

-- Allow 'free' plan again
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_plan_check 
CHECK (plan IN ('free', 'solo', 'team'));

ALTER TABLE public.profiles
ALTER COLUMN plan SET DEFAULT 'free';

-- Update existing plans
UPDATE public.profiles
SET plan = 'free'
WHERE plan = 'solo';
```

---

## Final Checklist

- [ ] All tables created successfully
- [ ] RLS enabled on all tables
- [ ] Trigger working (profiles auto-created)
- [ ] Functions working (add/deduct credits)
- [ ] Plan defaults to 'solo'
- [ ] Email column removed from profiles
- [ ] Environment variables configured
- [ ] Smoke tests passed
- [ ] No errors in Supabase logs

---

## Next Steps

✅ **Step 1 Complete** → Ready for **Step 2: Frontend Setup**

Proceed to:
1. Configure Supabase client in frontend
2. Implement authentication flows
3. Display credit balance
4. Build profile management
5. Create credit history view

Refer to:
- `database/BACKEND_INTEGRATION.md` for backend API examples
- `database/QUICK_REFERENCE.md` for SQL queries
- `database/ARCHITECTURE.md` for system design

---

**Last Updated**: 2026-01-25  
**Schema Version**: 1.0 (with 3 safety revisions)
