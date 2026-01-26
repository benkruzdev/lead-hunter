import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Types
export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  language: 'tr' | 'en';
  credits: number;
  plan: 'solo' | 'team';
  role: 'user' | 'admin';
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};


export type CreditTransaction = {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  description: string;
  transaction_type:
  | 'search_page'
  | 'lead_add'
  | 'enrichment'
  | 'plan_renew'
  | 'manual_add'
  | 'manual_deduct'
  | 'refund';
  metadata: Record<string, any> | null;
  created_at: string;
};
