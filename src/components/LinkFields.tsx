import { ClipboardPaste, ExternalLink, Instagram, Linkedin, Lock } from 'lucide-react';

interface Props {
  linkedin: string;
  onLinkedin: (v: string) => void;
  instagram: string;
  onInstagram: (v: string) => void;
  linkedinError?: boolean;
  instagramError?: boolean;
}

export function LinkFields(p: Props) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) p.onLinkedin(text.trim());
    } catch {
      /* fallback: user pastes manually */
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
            קישור לפרופיל LinkedIn <span className="font-normal text-muted">(חובה)</span>
          </span>
          <a
            href="https://www.linkedin.com/public-profile/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[#0A66C2]/10 px-2.5 py-1 text-[11px] font-bold text-[#0A66C2] transition hover:bg-[#0A66C2]/20"
          >
            מצא את הקישור שלי
            <ExternalLink size={11} />
          </a>
        </div>
        <div className="relative">
          <Linkedin size={17} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[#0A66C2]" />
          <input
            dir="ltr"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            className={`field !pr-11 ${!p.linkedin ? '!pl-20' : ''} text-right placeholder:text-right ${p.linkedinError ? '!border-danger' : ''}`}
            placeholder="linkedin.com/in/…"
            value={p.linkedin}
            onChange={(e) => p.onLinkedin(e.target.value)}
          />
          {!p.linkedin && (
            <button
              type="button"
              onClick={handlePaste}
              className="absolute top-1/2 left-2.5 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-ink transition hover:bg-slate-200"
            >
              <ClipboardPaste size={13} />
              הדבק
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          בטלפון? בפרופיל שלך בלינקדאין לחץ על <span className="font-bold text-ink">⋯ (עוד)</span> ← <span className="font-bold text-ink">שתף פרופיל</span> ← <span className="font-bold text-ink">העתק קישור</span>.
        </p>
        {p.linkedinError && <span className="mt-1 block text-xs text-danger">הדביקו קישור בפורמט linkedin.com/in/השם-שלכם</span>}
      </div>

      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
          Instagram <span className="font-normal text-muted">(לא חובה)</span>
        </span>
        <div className="relative">
          <Instagram size={17} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[#DD2A7B]" />
          <input
            dir="ltr"
            autoCapitalize="off"
            autoCorrect="off"
            className={`field !pr-11 text-right placeholder:text-right ${p.instagramError ? '!border-danger' : ''}`}
            placeholder="@username"
            value={p.instagram}
            onChange={(e) => p.onInstagram(e.target.value)}
          />
        </div>
      </label>

      <p className="flex items-start gap-1.5 rounded-xl bg-primary-soft px-3 py-2 text-xs leading-relaxed text-ink/80">
        <Lock size={13} className="mt-0.5 shrink-0 text-primary" />
        הקישורים נעולים ומוסתרים. הם נחשפים רק למי שאישרתם לו בקשה.
      </p>
    </div>
  );
}
