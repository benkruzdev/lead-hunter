# Backend Integration Guide - Credit Functions

## 🔒 Security Architecture

The credit functions (`deduct_credits` and `add_credits`) are marked as `SECURITY DEFINER`, which means they bypass Row Level Security (RLS) and execute with the permissions of the function owner.

### ⚠️ Critical Rules

1. **Frontend MUST NEVER call these functions directly**
2. **Backend (Render service) ONLY** should call these functions
3. Use **Supabase Service Role Key** (never the anon key)
4. Always validate and authorize operations on backend before calling

---

## Backend Setup

### Environment Variables (.env on Render)

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # NOT the anon key!
```

### Install Supabase Client (Backend)

```bash
npm install @supabase/supabase-js
```

### Initialize Supabase Client (Backend)

```typescript
// lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

// Use service role key for admin operations
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key, NOT anon key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

---

## Credit Operation Examples

### 1. Deduct Credits (Search Page View)

**Frontend Request**:
```typescript
// Frontend: src/api/search.ts
export async function viewSearchPage(sessionId: string, pageNumber: number) {
  // Frontend sends request to backend API
  const response = await fetch('/api/search/view-page', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}` // User's JWT
    },
    body: JSON.stringify({ sessionId, pageNumber })
  });
  
  return response.json();
}
```

**Backend Handler**:
```typescript
// Backend: api/search/view-page.ts
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  // 1. Authenticate user from JWT
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  
  if (!userData.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = userData.user.id;
  const { sessionId, pageNumber } = await req.json();
  
  // 2. Business logic validation
  const session = await getSearchSession(sessionId);
  
  if (session.user_id !== userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Check if page was already opened (FREE if within 30 days)
  if (session.opened_pages.includes(pageNumber)) {
    return Response.json({ 
      success: true, 
      charged: false,
      message: 'Page already viewed'
    });
  }
  
  // 3. Deduct credits using service role
  const SEARCH_PAGE_COST = 10;
  
  const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: SEARCH_PAGE_COST,
    p_type: 'search_page',
    p_description: `Search page ${pageNumber} for session ${sessionId}`
  });
  
  if (error || !data) {
    return Response.json({ 
      error: 'Insufficient credits',
      required: SEARCH_PAGE_COST 
    }, { status: 402 });
  }
  
  // 4. Update session to mark page as opened
  await supabaseAdmin
    .from('search_sessions')
    .update({ 
      opened_pages: [...session.opened_pages, pageNumber] 
    })
    .eq('id', sessionId);
  
  // 5. Fetch and return search results
  const results = await fetchSearchResults(session, pageNumber);
  
  return Response.json({ 
    success: true, 
    charged: true,
    amount: SEARCH_PAGE_COST,
    results 
  });
}
```

---

### 2. Deduct Credits (Add to List)

**Frontend Request**:
```typescript
// Frontend: src/api/leads.ts
export async function addLeadsToList(listId: string, leadIds: string[]) {
  const response = await fetch('/api/leads/add-to-list', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ listId, leadIds })
  });
  
  return response.json();
}
```

**Backend Handler**:
```typescript
// Backend: api/leads/add-to-list.ts
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  
  if (!userData.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = userData.user.id;
  const { listId, leadIds } = await req.json();
  
  // Validate list ownership
  const { data: list } = await supabaseAdmin
    .from('lead_lists')
    .select('user_id')
    .eq('id', listId)
    .single();
  
  if (!list || list.user_id !== userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Calculate cost (1 credit per lead)
  const COST_PER_LEAD = 1;
  const totalCost = leadIds.length * COST_PER_LEAD;
  
  // Deduct credits
  const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: totalCost,
    p_type: 'add_to_list',
    p_description: `Added ${leadIds.length} leads to list ${listId}`
  });
  
  if (error || !data) {
    return Response.json({ 
      error: 'Insufficient credits',
      required: totalCost 
    }, { status: 402 });
  }
  
  // Add leads to list
  const leadRecords = leadIds.map(leadId => ({
    list_id: listId,
    // ... other lead data
  }));
  
  await supabaseAdmin
    .from('leads')
    .insert(leadRecords);
  
  return Response.json({ 
    success: true, 
    charged: totalCost,
    leads_added: leadIds.length 
  });
}
```

---

### 3. Add Credits (Purchase)

**Backend Handler**:
```typescript
// Backend: api/billing/webhook.ts
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  // Validate webhook signature from payment provider
  const signature = req.headers.get('x-webhook-signature');
  if (!validateWebhookSignature(signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const { userId, amount, packageId } = await req.json();
  
  // Determine credit amount based on package
  const creditPackages = {
    'starter': 1000,
    'professional': 5000,
    'enterprise': 20000
  };
  
  const creditsToAdd = creditPackages[packageId];
  
  // Add credits to user account
  await supabaseAdmin.rpc('add_credits', {
    p_user_id: userId,
    p_amount: creditsToAdd,
    p_type: 'purchase',
    p_description: `Purchased ${packageId} package (${creditsToAdd} credits)`
  });
  
  return Response.json({ success: true });
}
```

---

### 4. Manual Credit Admin Operations

**Backend Handler**:
```typescript
// Backend: api/admin/credits/adjust.ts
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  
  if (!userData.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check if user is admin
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();
  
  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const { targetUserId, amount, reason } = await req.json();
  
  if (amount > 0) {
    // Add credits
    await supabaseAdmin.rpc('add_credits', {
      p_user_id: targetUserId,
      p_amount: amount,
      p_type: 'manual_add',
      p_description: `Admin adjustment: ${reason}`
    });
  } else {
    // Deduct credits
    await supabaseAdmin.rpc('deduct_credits', {
      p_user_id: targetUserId,
      p_amount: Math.abs(amount),
      p_type: 'manual_deduct',
      p_description: `Admin adjustment: ${reason}`
    });
  }
  
  return Response.json({ success: true });
}
```

---

## Frontend Integration (Read-Only)

The frontend can **read** credit balance but **never modify** it.

### Check Credit Balance

```typescript
// Frontend: Use regular Supabase client with anon key
import { supabase } from '@/lib/supabase';

export async function getCurrentCredits() {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single();
  
  return profile?.credits ?? 0;
}
```

### Display Credit History (Ledger)

```typescript
// Frontend: Read credit ledger
export async function getCreditHistory(limit = 50) {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return data ?? [];
}
```

---

## Cost Constants

Create a shared constants file for credit costs:

```typescript
// shared/constants/credits.ts
export const CREDIT_COSTS = {
  SEARCH_PAGE: 10,
  ADD_TO_LIST: 1,
  ENRICHMENT_SUCCESS: 5, // Adjust based on enrichment provider cost
  CSV_EXPORT: 0,
  EXCEL_EXPORT: 0
} as const;

export type CreditType = 
  | 'search_page'
  | 'add_to_list'
  | 'enrichment'
  | 'manual_add'
  | 'manual_deduct'
  | 'purchase';
```

---

## Testing

### Local Testing

```typescript
// Test deduct_credits
const result = await supabaseAdmin.rpc('deduct_credits', {
  p_user_id: 'test-user-uuid',
  p_amount: 10,
  p_type: 'search_page',
  p_description: 'Test deduction'
});

console.log('Deduction result:', result.data); // true = success, false = insufficient credits

// Test add_credits
await supabaseAdmin.rpc('add_credits', {
  p_user_id: 'test-user-uuid',
  p_amount: 100,
  p_type: 'manual_add',
  p_description: 'Test credit addition'
});
```

---

## Summary

✅ **DO**:
- Call credit functions from backend with service role key
- Validate user authentication before credit operations
- Check business logic (ownership, permissions) before deducting
- Use consistent credit costs across the application
- Log all credit transactions with clear descriptions

❌ **DON'T**:
- Never expose service role key to frontend
- Never call `deduct_credits` or `add_credits` from frontend
- Never allow users to modify credits directly via RLS policies
- Never skip authentication/authorization checks before credit operations
