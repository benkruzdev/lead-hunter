# Database Schema Quick Reference

## Tables Overview

### 1. profiles
Core user profile and account information.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID | - | FK to auth.users |
| full_name | TEXT | NULL | User's full name |
| phone | TEXT | NULL | TR format: 05xx xxx xx xx |
| plan | TEXT | 'solo' | ✅ NEW: Changed from 'free' |
| credits | INTEGER | 0 | Current credit balance |
| role | TEXT | 'user' | user \| admin |
| is_active | BOOLEAN | true | Account status |
| created_at | TIMESTAMP | NOW() | - |
| updated_at | TIMESTAMP | NOW() | - |

**Note**: ✅ Email field REMOVED (use auth.users.email instead)

**Constraints**:
- `plan IN ('solo', 'team')` - Only Solo and Team plans allowed
- `role IN ('user', 'admin')`

**RLS Policies**:
- Users can view/update own profile (cannot modify credits/plan directly)
- Admins can view/update all profiles

---

### 2. credit_ledger
Transaction history for all credit operations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Auto-generated |
| user_id | UUID | FK to profiles |
| amount | INTEGER | Positive for add, negative for deduct |
| type | TEXT | search_page, add_to_list, enrichment, manual_add, manual_deduct, purchase |
| description | TEXT | Human-readable transaction note |
| created_at | TIMESTAMP | Transaction timestamp |

**RLS Policies**:
- Users can view own ledger
- Admins can view all ledgers

---

### 3. search_sessions
Cached search results (30-day expiry).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Session ID |
| user_id | UUID | FK to profiles |
| city | TEXT | Search filter |
| district | TEXT | Search filter |
| category | TEXT | Search filter |
| min_rating | DECIMAL(2,1) | Search filter |
| min_reviews | INTEGER | Search filter |
| total_results | INTEGER | Total matches found |
| opened_pages | INTEGER[] | Already viewed pages (free re-view) |
| created_at | TIMESTAMP | - |
| expires_at | TIMESTAMP | Default: +30 days |

**Business Logic**:
- First page view: **10 credits**
- Already opened page (within 30 days): **FREE**

---

### 4. lead_lists
User-created collections of leads.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | List ID |
| user_id | UUID | FK to profiles |
| name | TEXT | List name |
| description | TEXT | Optional description |
| created_at | TIMESTAMP | - |
| updated_at | TIMESTAMP | - |

**RLS Policies**:
- Full CRUD on own lists only

---

### 5. leads
Individual lead records within lists.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Lead ID |
| list_id | UUID | FK to lead_lists |
| business_name | TEXT | Required |
| phone | TEXT | From search results |
| website | TEXT | From search results |
| email | TEXT | From enrichment |
| address | TEXT | - |
| city | TEXT | - |
| district | TEXT | - |
| category | TEXT | - |
| rating | DECIMAL(2,1) | Google rating |
| review_count | INTEGER | Number of reviews |
| score | TEXT | hot \| warm \| cold (auto-calculated) |
| pipeline_status | TEXT | User-defined |
| notes | TEXT | User notes |
| tags | TEXT[] | User tags |
| is_enriched | BOOLEAN | Whether enrichment ran |
| social_links | JSONB | Social media URLs |
| created_at | TIMESTAMP | - |
| updated_at | TIMESTAMP | - |

**Lead Score Logic**:
- **Hot**: ⭐ 4.5+ rating AND 200+ reviews
- **Warm**: ⭐ 4.0+ rating AND 50+ reviews
- **Cold**: Everything else

**Enrichment Cost**: Variable (only charged if data found)

---

### 6. exports
Export history and metadata.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Export ID |
| user_id | UUID | FK to profiles |
| list_id | UUID | FK to lead_lists (nullable) |
| file_name | TEXT | Export filename |
| format | TEXT | csv \| excel |
| lead_count | INTEGER | Number of leads exported |
| notes | TEXT | Optional notes |
| file_url | TEXT | Storage URL |
| created_at | TIMESTAMP | - |

**Export Cost**: **FREE** (0 credits)

---

## Functions

### ⚠️ Backend-Only Functions (SECURITY DEFINER)

#### deduct_credits(p_user_id, p_amount, p_type, p_description)
Deducts credits from user account with transaction logging.

**Returns**: BOOLEAN (true = success, false = insufficient credits)

**Example**:
```sql
SELECT deduct_credits(
  'user-uuid',
  10,
  'search_page',
  'Search page 2 for session abc123'
);
```

#### add_credits(p_user_id, p_amount, p_type, p_description)
Adds credits to user account with transaction logging.

**Returns**: VOID

**Example**:
```sql
SELECT add_credits(
  'user-uuid',
  1000,
  'purchase',
  'Purchased Starter package'
);
```

**🚨 SECURITY WARNING**: These functions should ONLY be called from backend with service role key!

---

## Triggers

### handle_new_user()
Automatically creates a profile when a new user signs up.

**Trigger**: `on_auth_user_created`  
**Fires**: AFTER INSERT on auth.users

**Auto-populated Fields**:
- `id` from auth.users.id
- `full_name` from raw_user_meta_data->>'full_name'
- `phone` from raw_user_meta_data->>'phone'
- `plan` defaults to 'solo'

---

## Credit Economy

| Operation | Cost | Notes |
|-----------|------|-------|
| Search - First Page | 0 credits | Free to start |
| Search - Next Page | 10 credits | Charged on first view |
| Search - Re-open Page | 0 credits | FREE within 30 days |
| Add to List | 1 credit/lead | Per lead added |
| Enrichment | Variable | Only if data found |
| CSV Export | 0 credits | Always free |
| Excel Export | 0 credits | Always free |

---

## Common Queries

### Get user's current credits
```sql
SELECT credits 
FROM profiles 
WHERE id = auth.uid();
```

### Get credit transaction history
```sql
SELECT * 
FROM credit_ledger 
WHERE user_id = auth.uid() 
ORDER BY created_at DESC 
LIMIT 50;
```

### Get email from profile (with JOIN)
```sql
SELECT p.*, u.email 
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.id = auth.uid();
```

### Check if search page already opened
```sql
SELECT 2 = ANY(opened_pages) as is_opened
FROM search_sessions
WHERE id = 'session-id';
```

### Get leads with enriched data
```sql
SELECT * 
FROM leads 
WHERE list_id = 'list-id' 
  AND is_enriched = true;
```

---

## Indexes

Performance indexes created on:
- `credit_ledger.user_id`
- `credit_ledger.created_at DESC`
- `search_sessions.user_id`
- `search_sessions.created_at DESC`
- `search_sessions.expires_at`
- `lead_lists.user_id`
- `leads.list_id`
- `leads.score`
- `leads.created_at DESC`
- `exports.user_id`
- `exports.created_at DESC`

---

## RLS Security Summary

✅ **All tables have RLS enabled**

**User Permissions**:
- ✅ Can view/edit own data
- ❌ Cannot modify credits directly
- ❌ Cannot modify plan directly
- ❌ Cannot access other users' data

**Admin Permissions**:
- ✅ Can view all data
- ✅ Can update all profiles
- ✅ Can view all credit ledgers
- ✅ Can perform manual credit adjustments (via backend)
