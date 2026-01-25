# Architecture Diagram - LeadHunter Credit System

## System Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  Supabase Client (Anon Key)                                 │     │
│  │  - Authentication (JWT)                                      │     │
│  │  - Read profiles.credits (RLS protected)                    │     │
│  │  - Read credit_ledger (RLS protected)                       │     │
│  │  - Manage leads, lists (RLS protected)                      │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  Actions:                                                               │
│  ✅ Display credit balance                                            │
│  ✅ Show credit history                                               │
│  ✅ Pre-check: "This will cost X credits"                             │
│  ❌ Cannot call deduct_credits()                                      │
│  ❌ Cannot call add_credits()                                         │
│  ❌ Cannot modify credits directly                                    │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ API Requests
                                    │ (with JWT token)
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js on Render)                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  Supabase Admin Client (Service Role Key)                   │     │
│  │  - Bypass RLS for credit operations                         │     │
│  │  - Full access to all tables                                │     │
│  │  - Can call SECURITY DEFINER functions                      │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  API Endpoints:                                                         │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  POST /api/search/view-page                                 │     │
│  │   → Validate JWT                                             │     │
│  │   → Check if page already opened (free)                     │     │
│  │   → Call deduct_credits(10, 'search_page')                  │     │
│  │   → Return search results                                    │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  POST /api/leads/add-to-list                                │     │
│  │   → Validate JWT                                             │     │
│  │   → Validate list ownership                                  │     │
│  │   → Call deduct_credits(count * 1, 'add_to_list')          │     │
│  │   → Insert leads into list                                   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  POST /api/billing/webhook                                   │     │
│  │   → Validate payment webhook signature                       │     │
│  │   → Call add_credits(amount, 'purchase')                    │     │
│  │   → Return success                                           │     │
│  └─────────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SQL Functions
                                    │ (Service Role Only)
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                           SUPABASE DATABASE                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  SECURITY DEFINER Functions                                  │     │
│  │  (Bypass RLS - Backend Use Only)                            │     │
│  │                                                               │     │
│  │  deduct_credits(user_id, amount, type, desc)                │     │
│  │   1. Lock row: SELECT FOR UPDATE                            │     │
│  │   2. Check: credits >= amount                               │     │
│  │   3. Update: profiles.credits -= amount                     │     │
│  │   4. Insert: credit_ledger (negative amount)                │     │
│  │   5. Return: true/false                                     │     │
│  │                                                               │     │
│  │  add_credits(user_id, amount, type, desc)                   │     │
│  │   1. Update: profiles.credits += amount                     │     │
│  │   2. Insert: credit_ledger (positive amount)                │     │
│  │   3. Return: void                                           │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  Tables with RLS                                             │     │
│  │                                                               │     │
│  │  profiles                                                     │     │
│  │   → Users can view own (id = auth.uid())                    │     │
│  │   → Users can update own (except credits/plan)              │     │
│  │   → Admins can view/update all                              │     │
│  │                                                               │     │
│  │  credit_ledger                                               │     │
│  │   → Users can view own transactions                          │     │
│  │   → Admins can view all transactions                         │     │
│  │   → Nobody can insert directly (only via functions)          │     │
│  │                                                               │     │
│  │  search_sessions, lead_lists, leads, exports                │     │
│  │   → Full RLS protection per user                            │     │
│  └─────────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Credit Operation Flow

### Example: User Views Search Page 2

```
┌──────────┐
│  FRONTEND │
└─────┬────┘
      │
      │ 1. User clicks "Next Page"
      │
      │ 2. Frontend checks current credits
      │    GET /profiles?select=credits
      │    Response: { credits: 150 }
      │
      │ 3. Frontend shows confirmation
      │    "This will cost 10 credits. Continue?"
      │
      │ 4. User confirms
      │    POST /api/search/view-page
      │    Body: { sessionId, pageNumber: 2 }
      │    Headers: { Authorization: Bearer <JWT> }
      │
      ▼
┌──────────┐
│  BACKEND  │
└─────┬────┘
      │
      │ 5. Validate JWT token
      │    const user = await supabaseAdmin.auth.getUser(token)
      │    ✓ Valid
      │
      │ 6. Get search session
      │    SELECT * FROM search_sessions WHERE id = sessionId
      │    ✓ Session exists
      │
      │ 7. Check ownership
      │    session.user_id === user.id
      │    ✓ Authorized
      │
      │ 8. Check if page already opened
      │    2 IN session.opened_pages
      │    ✗ Not opened yet
      │
      │ 9. Call deduct_credits
      │    supabaseAdmin.rpc('deduct_credits', {
      │      p_user_id: user.id,
      │      p_amount: 10,
      │      p_type: 'search_page',
      │      p_description: 'Page 2 of session abc123'
      │    })
      │
      ▼
┌──────────┐
│ SUPABASE │
└─────┬────┘
      │
      │ 10. Execute deduct_credits function (SECURITY DEFINER)
      │
      │ 11. Lock user row
      │     SELECT credits FROM profiles WHERE id = user.id FOR UPDATE
      │     Current credits: 150
      │
      │ 12. Check sufficient credits
      │     150 >= 10
      │     ✓ OK
      │
      │ 13. Deduct credits (atomic)
      │     UPDATE profiles SET credits = credits - 10
      │     New balance: 140
      │
      │ 14. Log transaction
      │     INSERT INTO credit_ledger
      │     (user_id, amount, type, description)
      │     VALUES (user.id, -10, 'search_page', 'Page 2...')
      │
      │ 15. Return true
      │
      ▼
┌──────────┐
│  BACKEND  │
└─────┬────┘
      │
      │ 16. Update search session
      │     UPDATE search_sessions
      │     SET opened_pages = array_append(opened_pages, 2)
      │     WHERE id = sessionId
      │
      │ 17. Fetch search results from Google Places API
      │     (business logic)
      │
      │ 18. Return response
      │     { success: true, charged: 10, results: [...] }
      │
      ▼
┌──────────┐
│  FRONTEND │
└──────────┘
      │
      │ 19. Update local state
      │     credits = credits - 10  // 150 → 140
      │
      │ 20. Display search results
      │     + Show updated credit balance
      │
      └─ DONE
```

---

## Insufficient Credits Flow

### Example: User Has 5 Credits, Tries to View Page (Costs 10)

```
FRONTEND → BACKEND
  POST /api/search/view-page
  { sessionId, pageNumber: 3 }

BACKEND:
  1. Validate JWT ✓
  2. Check ownership ✓
  3. Page not opened yet ✓
  4. Call deduct_credits(user.id, 10, ...)

SUPABASE:
  deduct_credits function:
    Current credits: 5
    Required: 10
    5 < 10 → INSUFFICIENT
    Return FALSE ❌

BACKEND:
  Receive FALSE from function
  Return error response:
  {
    error: 'Insufficient credits',
    required: 10,
    current: 5,
    shortfall: 5
  }
  Status: 402 Payment Required

FRONTEND:
  Display error:
  "You need 10 credits but only have 5.
   Purchase more credits to continue."
  
  Show "Buy Credits" button
```

---

## Re-Opening Page Flow (FREE)

### Example: User Re-Opens Page 2 (Already Opened Before)

```
FRONTEND → BACKEND
  POST /api/search/view-page
  { sessionId, pageNumber: 2 }

BACKEND:
  1. Validate JWT ✓
  2. Get search session
     session.opened_pages = [1, 2, 3]
  3. Check if page already opened
     2 IN [1, 2, 3] → TRUE ✓
  4. Skip credit deduction ⏭️
  5. Fetch cached results
  6. Return response:
     {
       success: true,
       charged: false,  ← No charge!
       reason: 'Page already viewed',
       results: [...]
     }

FRONTEND:
  Display results
  Show message: "✓ No credits charged (already viewed)"
```

---

## Database Entity Relationship

```
auth.users
    ↓ (1:1)
profiles
    │
    ├─→ credit_ledger (1:many)
    ├─→ search_sessions (1:many)
    ├─→ lead_lists (1:many)
    │       ↓ (1:many)
    │   leads
    └─→ exports (1:many)
```

---

## RLS Policy Matrix

| Table | Users (SELECT) | Users (INSERT) | Users (UPDATE) | Users (DELETE) | Admin |
|-------|----------------|----------------|----------------|----------------|-------|
| profiles | Own only | ❌ | Own (not credits/plan) | ❌ | Full |
| credit_ledger | Own only | ❌ | ❌ | ❌ | View all |
| search_sessions | Own only | Own only | Own only | ❌ | Full |
| lead_lists | Own only | Own only | Own only | Own only | Full |
| leads | Via list owner | Via list owner | Via list owner | Via list owner | Full |
| exports | Own only | Own only | ❌ | ❌ | Full |

**Legend**:
- ✅ Allowed
- ❌ Denied
- "Own" = WHERE user_id = auth.uid()
- "Via list owner" = WHERE EXISTS (SELECT 1 FROM lead_lists WHERE id = leads.list_id AND user_id = auth.uid())

---

## Security Layers

```
Layer 1: Authentication
  ↓ JWT validation via Supabase Auth
  ↓ User identity verified

Layer 2: RLS Policies
  ↓ Users can only access own data
  ↓ Data isolation enforced

Layer 3: Backend Validation
  ↓ Business logic checks
  ↓ Ownership verification
  ↓ Authorization rules

Layer 4: SECURITY DEFINER Functions
  ↓ Credit operations
  ↓ Atomic transactions
  ↓ Ledger logging

✅ All layers must pass for sensitive operations
```

---

## Key Takeaways

1. **Frontend**: Read-only access to credits, shows UI, validates before sending requests
2. **Backend**: Validates everything, calls credit functions with service role key
3. **Database**: Enforces RLS, executes credit functions atomically
4. **Credit Functions**: SECURITY DEFINER = bypass RLS = backend-only access
5. **Email**: Stored in auth.users only, JOIN when needed in queries
6. **Plan**: Defaults to 'solo', only 'solo' or 'team' allowed
