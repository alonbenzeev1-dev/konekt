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
  /** Live status ("מה הקטע שלך כרגע?"). Missing until the current_intent migration is applied. */
  current_intent?: string | null;
  current_intent_at?: string | null;
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
  /** Their live status, only while it is fresh (the server decides). */
  current_intent?: string | null;
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
  /** Rooms: what it is and where it meets ("בניין רקנאטי"). Missing until the rooms_invites migration is applied. */
  description?: string | null;
  location_tag?: string | null;
  /** The secret in ?join=<code>. */
  invite_code?: string;
  /** One message pinned at the top of the room (only the creator sets it). */
  pinned_message_id?: string | null;
}

/** A group member as returned by get_group_members: links only when they chose to share. */
export interface GroupMember {
  member_id: string;
  first_name: string;
  headline: string | null;
  avatar_url: string | null;
  current_intent?: string | null;
  /** LinkedIn shared in this room. */
  share_socials: boolean;
  /** Instagram shared in this room (older servers: follows share_socials). */
  share_instagram?: boolean;
  linkedin_url: string | null;
  instagram_handle: string | null;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  /** 'linkedin' = a LinkedIn card rendered from the sender's shared link; 'poll' = a quick poll (poll_id). */
  kind?: 'text' | 'linkedin' | 'poll';
  poll_id?: string | null;
}

/** A reaction row; emoji = null means it was removed. Exactly one of the two message ids is set. */
export interface Reaction {
  id: string;
  message_id: string | null;
  group_message_id: string | null;
  user_id: string;
  emoji: string | null;
}

export interface PollOption {
  id: string;
  poll_id: string;
  position: number;
  label: string;
}

export interface GroupPoll {
  id: string;
  group_id: string;
  created_by: string | null;
  question: string;
  created_at: string;
  options: PollOption[];
}
