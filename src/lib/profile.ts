import { supabase } from './supabase';
import { compressAvatar } from './image';
import type { MyProfile } from './types';

export async function fetchMyProfile(uid: string): Promise<MyProfile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return (data as MyProfile) ?? null;
}

export async function uploadAvatar(uid: string, file: Blob): Promise<string> {
  const blob = file instanceof File ? await compressAvatar(file) : file;
  const path = `${uid}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/**
 * LinkedIn photo URLs expire, so on first login we copy the photo into our own Storage.
 * 1) Edge Function "import-avatar" (server-side, reliable)
 * 2) fallback: browser download → upload (works only if LinkedIn's CDN allows CORS)
 * Returns the stored URL, or null if both failed (the UI then asks for a manual photo).
 */
export async function importLinkedInAvatar(uid: string, pictureUrl: string | null): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('import-avatar', { body: {} });
    const url = (data as { avatar_url?: string } | null)?.avatar_url;
    if (!error && url) return url;
  } catch {
    /* function not deployed — try the fallback */
  }
  if (!pictureUrl) return null;
  try {
    const res = await fetch(pictureUrl, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') || blob.size > 2_000_000) return null;
    const file = new File([blob], 'linkedin.jpg', { type: blob.type });
    const stored = await uploadAvatar(uid, file);
    await supabase.from('profiles').update({ avatar_url: stored }).eq('id', uid);
    return stored;
  } catch {
    return null;
  }
}

/** Postgres check_violation (23514): e.g. a link that is not in the canonical https://www.linkedin.com/in/<slug> form. */
export const isInvalidLinkError = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23514';

export interface ProfileInput {
  first_name: string;
  headline: string | null;
  linkedin_url: string | null;
  instagram_handle: string | null;
  tags?: string[];
  avatar_url?: string | null;
  is_visible?: boolean;
  lat?: number;
  lng?: number;
}

export async function upsertProfile(uid: string, input: ProfileInput): Promise<MyProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: uid, ...input, last_seen_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as MyProfile;
}

/** Remember on the server that the walkthrough was seen. Best effort: localStorage still has it if this fails. */
export async function markGuideSeenRemote(uid: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ has_seen_guide: true }).eq('id', uid);
  if (error) console.warn('has_seen_guide not saved', error.message);
}

export async function setVisible(uid: string, is_visible: boolean) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_visible, last_seen_at: new Date().toISOString() })
    .eq('id', uid);
  if (error) throw error;
}
