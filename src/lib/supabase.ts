import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase goes live when the env vars are set (see .env.example and
 * supabase/schema.sql). Until then the app runs fully local via lib/store.ts.
 *
 * Auth is passwordless email OTP: the user gets a 6-digit code by mail.
 * Sessions persist in AsyncStorage (localStorage on web).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isBackendConfigured = supabase !== null;
