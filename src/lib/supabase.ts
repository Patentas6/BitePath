import { createClient } from '@supabase/supabase-js';

// Directly use the Supabase URL and Anon Key from the project context
const supabaseUrl = "https://nkfivkgnaxilwgfhxmyc.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rZml2a2duYXhpbHdnZmh4bXljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NTY1MTgsImV4cCI6MjA2MzQzMjUxOH0.y4noRz34SXGVsc6g_axclIakBBRrjVPoVqRli5U8lLs";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and Anon Key must be set.");
  // This condition should ideally not be met now as they are hardcoded
  // Consider throwing an error here in a real-world scenario if they were still expected from env
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);