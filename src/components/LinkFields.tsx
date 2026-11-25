import { useEffect, useRef } from 'react';
import { ClipboardPaste, ExternalLink, Instagram, Linkedin, Lock } from 'lucide-react';
import { toast } from '../lib/notify';
import { extractLinkedIn, normalizeInstagram, normalizeLinkedIn } from '../lib/social';

const LI_PREFIX = 'https://www.linkedin.com/in/';
/** LinkedIn redirects this to the signed-in user's own profile (app or browser). */
const LI_ME = 'https://www.linkedin.com/in/me/';

interface Props {
  linkedin: string;
  onLinkedin: (v: string) => void;
  instagram: string;
  onInstagram: (v: string) => void;
  linkedinError?: boolean;
  instagramError?: boolean;
  /** Onboarding: when the user returns to the tab after opening LinkedIn, pick the link off the clipboard. */
  autoCapture?: boolean;
}

/** The part after the visual prefix: a pasted URL collapses to its slug. */
const linkedinSlug = (v: string) => {
  const n = normalizeLinkedIn(v);
  return n ? n.slice(LI_PREFIX.length) : v;
};
const instagramHandle = (v: string) => normalizeInstagram(v) ?? v;

function PrefixInput({
  prefix,
  icon,
  error,
  ...input
}: {
  prefix: string;
  icon: React.ReactNode;
  error?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div
      dir="ltr"
      className={`field flex items-center !py-0 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgb(0_174_239/0.18)] ${error ? '!border-danger' : ''}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="ms-2 shrink-0 select-none text-sm text-muted">{prefix}</span>
      <input
        {...input}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-3 text-sm text-ink outline-none placeholder:text-muted/70"
      />
    </div>
  );
}

export function LinkFields(p: Props) {
  const openedLinkedin = useRef(false);
  const lastAuto = useRef('');
  const { linkedin, onLinkedin, autoCapture } = p;
  const linkedinValid = !!normalizeLinkedIn(linkedin);

  // Back from the LinkedIn app/tab with a profile link copied → fill it in, gently:
  // only after the user tapped "open my profile", and only for a link we have not used yet.
  useEffect(() => {
    if (!autoCapture || linkedinValid) return;
    const check = async () => {
      if (!openedLinkedin.current || document.visibilityState !== 'visible') return;
      try {
        const url = extractLinkedIn(await navigator.clipboard.readText());
        if (url && url !== lastAuto.current) {
          lastAuto.current = url;
          onLinkedin(url);
          toast('הקישור זוהה והודבק אוטומטית!', 'success');
        }
      } catch {
        /* clipboard blocked: the manual button still works */
      }
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [autoCapture, linkedinValid, onLinkedin]);

  const pasteCopied = async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return toast('אין גישה ללוח. הדביקו את הקישור ידנית בשדה.', 'error');
    }
    const url = extractLinkedIn(text);
    if (!url) return toast('לא מצאנו קישור לפרופיל LinkedIn בלוח. העתיקו אותו ונסו שוב.', 'error');
    onLinkedin(url);
    toast('הקישור הודבק', 'success');
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
          קישור לפרופיל LinkedIn <span className="font-normal text-muted">(חובה)</span>
        </span>

        {autoCapture && (
          <ol className="mb-2.5 space-y-1.5 rounded-2xl border border-[#0A66C2]/20 bg-[#0A66C2]/5 p-3 text-start">
            {[
              ['שלב 1', 'לחצו על "פתח את הפרופיל שלי בלינקדאין"'],
              ['שלב 2', 'באפליקציית לינקדאין לחצו על ⋯ (עוד) ← שתף פרופיל ← העתק קישור'],
              ['שלב 3', 'חזרו לכאן — הקישור יודבק אוטומטית'],
            ].map(([n, t], k) => (
              <li key={n} className="flex items-start gap-2.5 text-[13px] leading-snug text-ink">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A66C2] text-[11px] font-extrabold text-white">{k + 1}</span>
                <span>
                  <span className="font-bold">{n}: </span>
                  {t}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="mb-2 grid grid-cols-1 gap-2">
          <a
            href={LI_ME}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              openedLinkedin.current = true;
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0A66C2] px-3 py-2.5 text-sm font-bold text-white shadow-md transition-transform active:scale-[0.98]"
          >
            <ExternalLink size={15} />
            1. פתח את הפרופיל שלי בלינקדאין
          </a>
          <button
            type="button"
            onClick={pasteCopied}
            className="btn-ghost flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-bold"
          >
            <ClipboardPaste size={15} />
            2. הדבק קישור שהועתק
          </button>
        </div>

        <PrefixInput
          prefix="linkedin.com/in/"
          icon={<Linkedin size={17} className="text-[#0A66C2]" />}
          error={p.linkedinError}
          inputMode="url"
          placeholder="השם-שלך"
          value={linkedinSlug(linkedin)}
          onChange={(e) => onLinkedin(e.target.value)}
        />
        {!autoCapture && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          בלינקדאין לחץ על <span className="font-bold text-ink">⋯ (עוד)</span> ← <span className="font-bold text-ink">שתף פרופיל</span> ← <span className="font-bold text-ink">העתק קישור</span>, וחזור לכאן.
        </p>
        )}
        {p.linkedinError && <span className="mt-1 block text-xs text-danger">הדביקו קישור בפורמט linkedin.com/in/השם-שלכם</span>}
      </div>

      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
          Instagram <span className="font-normal text-muted">(לא חובה)</span>
        </span>
        <PrefixInput
          prefix="instagram.com/"
          icon={<Instagram size={17} className="text-[#DD2A7B]" />}
          error={p.instagramError}
          placeholder="username"
          value={instagramHandle(p.instagram)}
          onChange={(e) => p.onInstagram(e.target.value)}
        />
      </label>

      <p className="flex items-start gap-1.5 rounded-xl bg-primary-soft px-3 py-2 text-xs leading-relaxed text-ink/80">
        <Lock size={13} className="mt-0.5 shrink-0 text-primary" />
        הקישורים נעולים ומוסתרים. הם נחשפים רק למי שאישרתם לו בקשה.
      </p>
    </div>
  );
}
