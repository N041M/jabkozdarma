import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Supabase goes live when the env vars are set (see .env.example and
 * supabase/schema.sql). Until then the app runs fully local via lib/store.ts.
 *
 * Auth is a passwordless email magic link (works with Supabase's built-in
 * mailer, whose template can't be customized): the user taps the link and
 * detectSessionInUrl picks the session out of the redirect. If custom SMTP
 * with a {{ .Token }} template is configured, the same email carries a
 * 6-digit code and the in-app code field works too.
 * Sessions persist in AsyncStorage (localStorage on web).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Static export server-renders each route in Node, where there is no window/
// localStorage — creating the client there crashes on session restore. The
// client only exists in a real browser (or on native); isBackendConfigured
// stays env-based so server-rendered and hydrated UI match.
const isServerRender = Platform.OS === 'web' && typeof window === 'undefined';

export const isBackendConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null =
  url && anonKey && !isServerRender
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: Platform.OS === 'web',
        },
      })
    : null;
