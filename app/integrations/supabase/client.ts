import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://loazwwkypjxikuwvsirk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvYXp3d2t5cGp4aWt1d3ZzaXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTY2NDYsImV4cCI6MjA4NjA3MjY0Nn0.asm7fGcOUnNaqGwjvxV-8GlIyTl3WKRvZ52nOrZAiyQ";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
