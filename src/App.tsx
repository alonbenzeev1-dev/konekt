import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleHelp, Loader2 } from 'lucide-react';
import { Wordmark } from './components/Logo';
import { VisibilityToggle } from './components/VisibilityToggle';
import { HowItWorksModal } from './components/HowItWorksModal';
import { JoinInvite } from './components/JoinInvite';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { NotificationBell } from './components/NotificationBell';
import { TabBar, type Tab } from './components/TabBar';
import { Toaster } from './components/Toaster';
import { Welcome } from './screens/Welcome';
import { CompleteProfile } from './screens/CompleteProfile';
import { Radar } from './screens/Radar';
import { ChatsScreen } from './screens/ChatsScreen';
import { RequestsScreen } from './screens/RequestsScreen';
import { Chat } from './screens/Chat';
import { GroupChat } from './screens/GroupChat';
import { Profile } from './screens/Profile';
import { SetupNeeded } from './screens/SetupNeeded';
import { usePresence } from './hooks/usePresence';
import { useNearby } from './hooks/useNearby';
import { useInbox } from './hooks/useInbox';
import { useGroups } from './hooks/useGroups';
import { useGroupCandidates } from './hooks/useGroupCandidates';
import { useGuide } from './hooks/useGuide';
import { useNow } from './hooks/useNow';
import { isConfigured, linkedInIdentity, supabase } from './lib/supabase';
import { fetchMyProfile, setVisible } from './lib/profile';
import { subscribeToPush, toast } from './lib/notify';
import { msLeft } from './lib/time';
import { capturePendingJoin, markJoinAuto } from './lib/invite';
import { activeIntent } from './lib/intent';
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
  useState(capturePendingJoin); // ?join=<code>: remembered now, used after sign-in / onboarding
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
        markJoinAuto(); // a brand-new member who came through an invite joins the room without another prompt
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

/** Where a notification link points: ?tab=chats|requests|profile and, for a message, &chat=<chat id>. */
function parseDeepLink(href: string): { tab: Tab | null; chat: string | null } {
  try {
    const q = new URL(href, location.origin).searchParams;
    const t = q.get('tab');
    const chat = q.get('chat');
    return { tab: t === 'chats' || t === 'requests' || t === 'profile' ? t : t === 'inbox' ? 'requests' : null, chat: chat && /^[0-9a-f-]{36}$/i.test(chat) ? chat : null };
  } catch {
    return { tab: null, chat: null };
  }
}

function initialTab(): Tab {
  const t = new URLSearchParams(location.search).get('tab');
  if (t === 'chats' || t === 'requests' || t === 'profile') return t;
  return t === 'inbox' ? 'requests' : 'radar'; // 'inbox' = old notification links
}

function Main({ profile, onProfile, onSignedOut }: { profile: MyProfile; onProfile: (p: MyProfile) => void; onSignedOut: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [chatId, setChatId] = useState<string | null>(() => parseDeepLink(location.href).chat);
  const [groupId, setGroupId] = useState<string | null>(null);
  const guide = useGuide(profile, onProfile); // first time in the app, remembered on the profile
  const visible = profile.is_visible;

  const { coords, status: geo } = usePresence(profile.id, visible);
  const { users, campusCount, scanned } = useNearby(coords, visible);
  const inbox = useInbox(profile.id);
  const groups = useGroups(profile.id, groupId);
  const candidates = useGroupCandidates(profile.id, inbox, visible ? users : []);
  const now = useNow(15_000);

  useEffect(() => {
    void subscribeToPush(profile.id);
  }, [profile.id]);

  // the ?chat= of a tapped notification is used once: a reload should not reopen the chat
  useEffect(() => {
    const u = new URL(location.href);
    if (u.searchParams.has('chat')) {
      u.searchParams.delete('chat');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    }
  }, []);

  // a notification was tapped while the app was open: the service worker sends the link instead of reloading
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (d?.type !== 'konekt:navigate' || typeof d.url !== 'string') return;
      const { tab: t, chat } = parseDeepLink(d.url);
      setGroupId(null);
      if (t) setTab(t);
      setChatId(chat);
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, []);

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

  /** Optimistic: the card updates at once, and is rolled back if the server says no. */
  const saveIntent = useCallback(
    async (value: string | null): Promise<boolean> => {
      const prev = profile;
      onProfile({ ...profile, current_intent: value, current_intent_at: value ? new Date().toISOString() : null });
      const { error } = await supabase.from('profiles').update({ current_intent: value }).eq('id', profile.id);
      if (error) {
        onProfile(prev);
        toast('לא הצלחנו לשמור את הסטטוס. נסו שוב.', 'error');
        return false;
      }
      return true;
    },
    [profile, onProfile],
  );

  const badges = useMemo<Partial<Record<Tab, number>>>(() => {
    const pending = inbox.requests.filter(
      (r) => r.receiver_id === profile.id && r.status === 'pending' && msLeft(r.expires_at, now) > 0,
    ).length;
    // conversations with something unread: 1-on-1 chats + private groups
    const unreadChats = inbox.threads.filter((t) => t.unread > 0 && msLeft(t.chat.expires_at, now) > 0).length;
    const unreadGroups = Object.keys(groups.unread).length;
    return { requests: pending, chats: unreadChats + unreadGroups };
  }, [inbox.requests, inbox.threads, groups.unread, profile.id, now]);

  const titles: Record<Tab, string> = { radar: '', chats: 'צ׳אטים', requests: 'בקשות', profile: 'הפרופיל שלי' };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-card/90 px-4 pb-3 backdrop-blur-xl safe-top">
        <div className="flex min-h-[44px] items-center justify-between">
          <Wordmark className="text-[15px]" />
          <div className="flex items-center gap-1">
            <NotificationBell userId={profile.id} />
            <button
              onClick={guide.show}
              aria-label="איך זה עובד?"
              className="-mx-1 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors active:bg-bg"
            >
              <CircleHelp size={19} />
            </button>
            <VisibilityToggle on={visible} onChange={toggle} />
          </div>
        </div>
        {titles[tab] && <h1 className="mt-1 text-xl leading-tight font-extrabold text-ink">{titles[tab]}</h1>}
      </header>

      <InstallPwaBanner />

      <main className="flex-1">
        {tab === 'radar' && (
          <Radar
            myId={profile.id}
            visible={visible}
            onShow={() => toggle(true)}
            geo={geo}
            users={users}
            scanned={scanned}
            campusCount={campusCount}
            inbox={inbox}
            groups={groups}
            myIntent={activeIntent(profile)}
            onSaveIntent={saveIntent}
            onOpenChat={setChatId}
          />
        )}
        {tab === 'chats' && (
          <ChatsScreen myId={profile.id} inbox={inbox} groups={groups} candidates={candidates} onOpenChat={setChatId} onOpenGroup={setGroupId} />
        )}
        {tab === 'requests' && <RequestsScreen
            myId={profile.id}
            inbox={inbox}
            myLinks={{ linkedin: !!profile.linkedin_url, instagram: !!profile.instagram_handle }}
            nearby={visible ? users : []}
            onOpenChat={setChatId}
          />}
        {tab === 'profile' && (
          <Profile profile={profile} onProfile={onProfile} visible={visible} onToggle={toggle} onSignedOut={onSignedOut} />
        )}
      </main>

      <TabBar tab={tab} onTab={setTab} badges={badges} />

      <HowItWorksModal open={guide.open} onClose={guide.close} />
      <JoinInvite
        groups={groups}
        onJoined={(id) => {
          setTab('chats');
          setGroupId(id);
        }}
      />

      {chatId && <Chat myId={profile.id} chatId={chatId} inbox={inbox} onBack={() => setChatId(null)} />}
      {groupId && <GroupChat
          myId={profile.id}
          groupId={groupId}
          groups={groups}
          candidates={candidates}
          myLinks={{ linkedin: !!profile.linkedin_url, instagram: !!profile.instagram_handle }}
          onBack={() => setGroupId(null)}
        />}
    </>
  );
}
