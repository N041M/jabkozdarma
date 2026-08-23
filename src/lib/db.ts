import { supabase } from './supabase';
import {
  SPECIES,
  type AccessType,
  type FlagReason,
  type Profile,
  type RipenessState,
  type Tree,
  type TreeReport,
} from './types';
import type { NewTreeInput } from './store';

/**
 * All Supabase reads/writes. Only called when the backend is configured;
 * every function assumes `supabase` is non-null (guarded by callers).
 * The store stays the single source of truth for the UI — these functions
 * hydrate it on load and write mutations through.
 */

function sb() {
  if (!supabase) throw new Error('backend not configured');
  return supabase;
}

export function newId(): string {
  return crypto.randomUUID();
}

interface TreeRow {
  id: string;
  lat: number;
  lng: number;
  species: string;
  variety: string | null;
  description: string | null;
  access: AccessType;
  status: Tree['status'];
  season_start: number | null;
  season_end: number | null;
  created_by: string;
  created_at: string;
}

function photoUrl(storagePath: string): string {
  return sb().storage.from('tree-photos').getPublicUrl(storagePath).data.publicUrl;
}

export interface DbSnapshot {
  trees: Tree[];
  reports: TreeReport[];
  profiles: Profile[];
}

export async function fetchSnapshot(): Promise<DbSnapshot> {
  const client = sb();
  const [treesRes, reportsRes, profilesRes, photosRes] = await Promise.all([
    client.rpc('trees_in_bbox', { min_lng: -180, min_lat: -90, max_lng: 180, max_lat: 90 }),
    client.from('reports').select('id, tree_id, user_id, state, note, created_at'),
    client.from('profiles').select('id, username, bio, created_at'),
    client
      .from('tree_photos')
      .select('tree_id, storage_path, created_at')
      .order('created_at', { ascending: false }),
  ]);
  const firstError = treesRes.error ?? reportsRes.error ?? profilesRes.error ?? photosRes.error;
  if (firstError) throw firstError;

  // newest photo per tree
  const photoByTree = new Map<string, string>();
  for (const p of photosRes.data ?? []) {
    if (!photoByTree.has(p.tree_id)) photoByTree.set(p.tree_id, photoUrl(p.storage_path));
  }

  const trees: Tree[] = ((treesRes.data ?? []) as TreeRow[]).map((r) => ({
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    species: (SPECIES as readonly string[]).includes(r.species)
      ? (r.species as Tree['species'])
      : 'other',
    variety: r.variety,
    description: r.description,
    access: r.access,
    status: r.status,
    seasonStart: r.season_start,
    seasonEnd: r.season_end,
    photoUri: photoByTree.get(r.id) ?? null,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));

  const reports: TreeReport[] = (reportsRes.data ?? []).map((r) => ({
    id: r.id,
    treeId: r.tree_id,
    userId: r.user_id,
    state: r.state as RipenessState,
    note: r.note,
    createdAt: r.created_at,
  }));

  const profiles: Profile[] = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    bio: p.bio,
    createdAt: p.created_at,
  }));

  return { trees, reports, profiles };
}

export async function fetchFavorites(userId: string): Promise<string[]> {
  const { data, error } = await sb().from('favorites').select('tree_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((f) => f.tree_id);
}

export async function insertTree(id: string, input: NewTreeInput, userId: string): Promise<void> {
  const { error } = await sb().from('trees').insert({
    id,
    location: `SRID=4326;POINT(${input.lng} ${input.lat})`,
    species: input.species,
    variety: input.variety,
    description: input.description,
    access: input.access,
    season_start: input.seasonStart,
    season_end: input.seasonEnd,
    created_by: userId,
  });
  if (error) throw error;
}

export async function updateTree(id: string, patch: Partial<NewTreeInput>): Promise<void> {
  const row: Record<string, unknown> = {};
  if ('species' in patch) row.species = patch.species;
  if ('variety' in patch) row.variety = patch.variety;
  if ('description' in patch) row.description = patch.description;
  if ('access' in patch) row.access = patch.access;
  if ('seasonStart' in patch) row.season_start = patch.seasonStart;
  if ('seasonEnd' in patch) row.season_end = patch.seasonEnd;
  if (Object.keys(row).length === 0) return;
  const { error } = await sb().from('trees').update(row).eq('id', id);
  if (error) throw error;
}

/** Upload a local photo (data/blob/file URI) and return its public URL. */
export async function uploadTreePhoto(
  treeId: string,
  userId: string,
  localUri: string
): Promise<string> {
  const blob = await (await fetch(localUri)).blob();
  const path = `${treeId}/${newId()}.jpg`;
  const { error: uploadError } = await sb()
    .storage.from('tree-photos')
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' });
  if (uploadError) throw uploadError;
  const { error } = await sb()
    .from('tree_photos')
    .insert({ tree_id: treeId, user_id: userId, storage_path: path });
  if (error) throw error;
  return photoUrl(path);
}

export async function deleteTree(id: string): Promise<void> {
  // reports/photos/flags/favorites cascade via their foreign keys
  const { error } = await sb().from('trees').delete().eq('id', id);
  if (error) throw error;
}

export async function insertReport(report: TreeReport): Promise<void> {
  const { error } = await sb().from('reports').insert({
    id: report.id,
    tree_id: report.treeId,
    user_id: report.userId,
    state: report.state,
    note: report.note,
  });
  if (error) throw error;
}

export async function insertFlag(
  id: string,
  treeId: string,
  userId: string,
  reason: FlagReason
): Promise<void> {
  const { error } = await sb().from('flags').insert({
    id,
    tree_id: treeId,
    user_id: userId,
    reason,
  });
  // duplicate flag from the same user is a no-op, not an error worth surfacing
  if (error && error.code !== '23505') throw error;
}

export async function setFavorite(userId: string, treeId: string, on: boolean): Promise<void> {
  const client = sb();
  if (on) {
    const { error } = await client.from('favorites').upsert({ user_id: userId, tree_id: treeId });
    if (error) throw error;
  } else {
    const { error } = await client
      .from('favorites')
      .delete()
      .match({ user_id: userId, tree_id: treeId });
    if (error) throw error;
  }
}

// ---------- auth ----------

function appRedirectUrl(): string | undefined {
  return typeof window !== 'undefined'
    ? `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/`
    : undefined;
}

/** Web OAuth: redirects to Google and back; the session arrives in the URL. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await sb().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: appRedirectUrl() },
  });
  if (error) throw error;
}

export async function sendLoginCode(email: string, username: string): Promise<void> {
  // The email carries a magic link back to the app (and, with a custom SMTP
  // template, also a 6-digit code — both complete the same sign-in).
  const { error } = await sb().auth.signInWithOtp({
    email,
    options: { data: { username }, shouldCreateUser: true, emailRedirectTo: appRedirectUrl() },
  });
  if (error) throw error;
}

/**
 * Make sure a profile row exists for this user and return it.
 * Handles username collisions by suffixing.
 */
export async function ensureProfile(userId: string, desiredUsername: string): Promise<Profile> {
  const client = sb();
  const existing = await client
    .from('profiles')
    .select('id, username, bio, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    return {
      id: existing.data.id,
      username: existing.data.username,
      bio: existing.data.bio,
      createdAt: existing.data.created_at,
    };
  }
  const base = desiredUsername.trim() || `picker-${userId.slice(0, 8)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const username = attempt === 0 ? base : `${base}-${Math.floor(Math.random() * 900 + 100)}`;
    const { data, error } = await client
      .from('profiles')
      .insert({ id: userId, username })
      .select('id, username, bio, created_at')
      .single();
    if (!error && data) {
      return { id: data.id, username: data.username, bio: data.bio, createdAt: data.created_at };
    }
    if (error && error.code !== '23505') throw error; // not a unique violation
  }
  throw new Error('could not allocate a username');
}

export async function signOutBackend(): Promise<void> {
  await sb().auth.signOut();
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await sb().auth.getSession();
  return data.session?.user.id ?? null;
}
