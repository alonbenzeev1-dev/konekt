import { useCallback, useEffect, useState } from 'react';
import { hasSeenGuide, markGuideSeen } from '../components/HowItWorksModal';
import { markGuideSeenRemote } from '../lib/profile';
import type { MyProfile } from '../lib/types';

/**
 * The how-it-works walkthrough. Opens by itself only when neither the profile (profiles.has_seen_guide, shared
 * by Safari and the installed iOS app) nor this browser's localStorage says it was seen. Closing it in any way
 * records that in both places. `show()` reopens it by hand (the "?" button).
 */
export function useGuide(profile: MyProfile, onProfile: (p: MyProfile) => void) {
  const [open, setOpen] = useState(() => !profile.has_seen_guide && !hasSeenGuide());

  // Seen in this browser before the server knew (or the write failed last time): tell the server now,
  // so opening the installed app does not show it again.
  useEffect(() => {
    if (profile.has_seen_guide === false && hasSeenGuide()) void markGuideSeenRemote(profile.id);
  }, [profile.id, profile.has_seen_guide]);

  const close = useCallback(() => {
    markGuideSeen();
    setOpen(false);
    if (!profile.has_seen_guide) {
      void markGuideSeenRemote(profile.id);
      onProfile({ ...profile, has_seen_guide: true });
    }
  }, [profile, onProfile]);

  const show = useCallback(() => setOpen(true), []);
  return { open, show, close };
}
