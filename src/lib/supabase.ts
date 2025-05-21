import { createClient } from '@supabase/supabase-js';

// Ensure these environment variables are set in your .env.local file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and Anon Key must be set in environment variables.");
  // Depending on your setup, you might want to throw an error or handle this differently
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);