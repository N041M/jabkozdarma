import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase goes live when the env vars are set (see .env.example and
 * supabase/schema.sql). Until then the app runs fully local via lib/store.ts.
 *
 * Wiring plan (Phase 2):
 *  - auth: Supabase email + Apple/Google sign-in replaces the local profile
 *  - trees/reports/flags: hydrated via the trees_in_bbox RPC, mutations
 *    written through with optimistic local updates
 *  - photos: uploaded to the `tree-photos` storage bucket, EXIF stripped
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isBackendConfigured = supabase !== null;
