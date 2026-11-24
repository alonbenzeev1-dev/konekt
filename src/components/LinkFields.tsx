import { Instagram, Linkedin, Lock } from 'lucide-react';

interface Props {
  linkedin: string;
  onLinkedin: (v: string) => void;
  instagram: string;
  onInstagram: (v: string) => void;
  linkedinError?: boolean;
  instagramError?: boolean;
}

export function LinkFields(p: Props) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
          קישור לפרופיל LinkedIn <span className="font-normal text-muted">(חובה)</span>
        </span>
        <div className="relative">
          <Linkedin size={17} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[#0A66C2]" />
          <input
            dir="ltr"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            className={`field !pr-11 text-right placeholder:text-right ${p.linkedinError ? '!border-danger' : ''}`}
            placeholder="linkedin.com/in/…"
            value={p.linkedin}
            onChange={(e) => p.onLinkedin(e.target.value)}
          />
        </div>
        {p.linkedinError && <span className="mt-1 block text-xs text-danger">הדביקו קישור בפורמט linkedin.com/in/השם-שלכם</span>}
      </label>
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
