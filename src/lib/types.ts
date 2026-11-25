export type Platform = 'linkedin' | 'instagram';
export type RequestKind = Platform | 'chat';

export interface MyProfile {
  id: string;
  first_name: string;
  headline: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  instagram_handle: string | null;
  /** Quick campus tags (profiles.tags). Missing until the campus_tags migration is applied. */
  tags?: string[];
  /** Server-side "saw the walkthrough" flag. Missing until the has_seen_guide migration is applied. */
  has_seen_guide?: boolean;
  is_visible: boolean;
  lat: number | null;
  lng: number | null;
  last_seen_at: string;
}

/** What other people are allowed to see. Never contains links/handles. */
export interface PublicProfile {
  id: string;
  first_name: string;
  headline: string | null;
  avatar_url: string | null;
}

export interface NearbyUser extends PublicProfile {
  tags?: string[];
  has_linkedin: boolean;
  has_instagram: boolean;
  distance_m: number;
}

export interface ConnectionRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  kind: RequestKind;
  message: string | null;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

export interface Chat {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  expires_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

/** A group member as returned by get_group_members: links only when they chose to share. */
export interface GroupMember {
  member_id: string;
  first_name: string;
  headline: string | null;
  avatar_url: string | null;
  share_socials: boolean;
  linkedin_url: string | null;
  instagram_handle: string | null;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
