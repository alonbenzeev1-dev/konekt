import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Wordmark } from './components/Logo';
import { VisibilityToggle } from './components/VisibilityToggle';
import { TabBar, type Tab } from './components/TabBar';
import { Toaster } from './components/Toaster';
import { Welcome } from './screens/Welcome';
import { CompleteProfile } from './screens/CompleteProfile';
import { Radar } from './screens/Radar';
import { Inbox } from './screens/Inbox';
import { Chat } from './screens/Chat';
import { Profile } from './screens/Profile';
import { SetupNeeded } from './screens/SetupNeeded';
import { usePresence } from './hooks/usePresence';
import { useNearby } from './hooks/useNearby';
import { useInbox } from './hooks/useInbox';
import { useNow } from './hooks/useNow';
import { isConfigured, linkedInIdentity, supabase } from './lib/supabase';
import { fetchMyProfile, setVisible } from './lib/profile';
import { subscribeToPush, toast } from './lib/notify';
import { msLeft } from './lib/time';
import type { MyProfile } from './lib/types';

type Boot =
  | { stage: 'loading' }
  | { stage: 'welcome' }
  | { stage: 'complete'; uid: string; name: string; picture: string | null }
  | { stage: 'ready' };

export default function App() {
  if (!isConfigured) return <SetupNeeded />;
  return <ConfiguredApp />;
}

function ConfiguredApp() {
  const [boot, setBoot] = useState<Boot>({ stage: 'loading' });
  const [profile, setProfile] = useState<MyProfile | null>(null);

  const resolve = useCallback(async () => {
    const { data } = await supabase.auth.getSession(); // also finishes the LinkedIn redirect (PKCE)
    const user = data.session?.user;
    if (new URLSearchParams(location.search).has('code')) {
      const u = new URL(location.href);
      u.searchParams.delete('code');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
    if (!user) return setBoot({ stage: 'welcome' });
    try {
      const p = await fetchMyProfile(user.id);
      if (p) {
        setProfile(p);
        setBoot({ stage: 'ready' });
      } else {
        const id = linkedInIdentity(user);
        setBoot({ stage: 'complete', uid: user.id, name: id.firstName, picture: id.picture });
      }
    } catch {
      toast('אין חיבור לשרת', 'error');
      setBoot({ stage: 'welcome' });
    }
  }, []);

  useEffect(() => {
    void resolve();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setBoot({ stage: 'welcome' });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [resolve]);

  return (
    <div className="mx-auto flex min-h-full max-w-[480px] flex-col overflow-x-clip bg-bg sm:border-x sm:border-line">
      <Toaster />
      {boot.stage === 'loading' && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      )}
      {boot.stage === 'welcome' && <Welcome />}
      {boot.stage === 'complete' && (
        <CompleteProfile
          uid={boot.uid}
          initialName={boot.name}
          linkedinPicture={boot.picture}
          onDone={(p) => {
            setProfile(p);
            setBoot({ stage: 'ready' });
          }}
        />
      )}
      {boot.stage === 'ready' && profile && (
        <Main profile={profile} onProfile={setProfile} onSignedOut={() => setBoot({ stage: 'welcome' })} />
      )}
    </div>
  );
}

function initialTab(): Tab {
  const t = new URLSearchParams(location.search).get('tab');
  return t === 'inbox' || t === 'profile' ? t : 'radar';
}

function Main({ profile, onProfile, onSignedOut }: { profile: MyProfile; onProfile: (p: MyProfile) => void; onSignedOut: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [chatId, setChatId] = useState<string | null>(null);
  const visible = profile.is_visible;

  const { coords, status: geo } = usePresence(profile.id, visible);
  const { users, campusCount } = useNearby(coords, visible);
  const inbox = useInbox(profile.id);
  const now = useNow(15_000);

  useEffect(() => {
    void subscribeToPush(profile.id);
  }, [profile.id]);

  const toggle = useCallback(
    async (on: boolean) => {
      const prev = profile;
      onProfile({ ...profile, is_visible: on });
      try { navigator.vibrate?.(25); } catch { /* noop */ }
      try {
        await setVisible(profile.id, on);
        toast(on ? 'גלוי בסביבה — אנשים לידך רואים אותך' : 'מוסתר — אף אחד לא רואה אותך', on ? 'success' : 'info');
      } catch {
        onProfile(prev);
        toast('לא הצלחנו לעדכן', 'error');
      }
    },
    [profile, onProfile],
  );

  const badge = useMemo(() => {
    const pending = inbox.requests.filter(
      (r) => r.receiver_id === profile.id && r.status === 'pending' && msLeft(r.expires_at, now) > 0,
    ).length;
    const unread = inbox.threads.filter((t) => t.unread > 0).length;
    return pending + unread;
  }, [inbox.requests, inbox.threads, profile.id, now]);

  const titles: Record<Tab, string> = { radar: '', inbox: 'בקשות וצ׳אט', profile: 'הפרופיל שלי' };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-card/90 px-4 pb-3 backdrop-blur-xl safe-top">
        <div className="flex items-center justify-between pt-1">
          <Wordmark className="text-[15px]" />
          <VisibilityToggle on={visible} onChange={toggle} />
        </div>
        {titles[tab] && <h1 className="mt-3 text-xl font-extrabold text-ink">{titles[tab]}</h1>}
      </header>

      <main className="flex-1">
        {tab === 'radar' && (
          <Radar
            myId={profile.id}
            visible={visible}
            onShow={() => toggle(true)}
            geo={geo}
            users={users}
            campusCount={campusCount}
            inbox={inbox}
            onOpenChat={setChatId}
          />
        )}
        {tab === 'inbox' && <Inbox myId={profile.id} inbox={inbox} onOpenChat={setChatId} />}
        {tab === 'profile' && (
          <Profile profile={profile} onProfile={onProfile} visible={visible} onToggle={toggle} onSignedOut={onSignedOut} />
        )}
      </main>

      <TabBar tab={tab} onTab={setTab} badge={badge} />

      {chatId && <Chat myId={profile.id} chatId={chatId} inbox={inbox} onBack={() => setChatId(null)} />}
    </>
  );
}
