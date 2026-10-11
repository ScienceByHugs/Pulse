import { authStorage } from '@/lib/privateStorage';
import { createClient } from '@supabase/supabase-js';
import { backend } from '@/config/backend';

export const supabase = createClient(backend.url, backend.publishableKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
