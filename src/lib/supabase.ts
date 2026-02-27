import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with optimal settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage (default, recommended)
    storage: window.localStorage,

    // Auto refresh tokens before expiry
    autoRefreshToken: true,

    // Persist user session across browser tabs
    persistSession: true,

    // Detect session in URL (for OAuth, magic links)
    detectSessionInUrl: true,

    // Flow type for PKCE (recommended for SPAs)
    flowType: 'pkce',
  },
});
