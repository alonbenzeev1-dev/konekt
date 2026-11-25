import { useState } from 'react';
import { Check, Loader2, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';
import { toast } from '../lib/notify';

export interface GroupCandidate {
  id: string;
  first_name: string;
  headline: string | null;
  avatar_url: string | null;
  source: 'connection' | 'nearby';
}

interface Props {
  open: boolean;
  onClose: () => void;
  candidates: GroupCandidate[];
  onCreate: (name: string, memberIds: string[]) => Promise<{ error: string | null }>;
}

export function CreateGroupSheet({ open, onClose, candidates, onCreate }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <CreateGroupForm candidates={candidates} onCreate={onCreate} />
    </BottomSheet>
  );
}

function CreateGroupForm({ candidates, onCreate }: Pick<Props, 'candidates' | 'onCreate'>) {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const { error } = await onCreate(name, [...picked]);
    setBusy(false);
    if (error) {
      toast(error.includes('unavailable') ? 'מישהו שבחרתם כבר לא זמין (לא לידך ולא מחובר). נסו בלי.' : 'לא הצלחנו ליצור את הקבוצה', 'error');
    }
  };

  const sections: { title: string; items: GroupCandidate[] }[] = [
    { title: 'החיבורים שלי', items: candidates.filter((c) => c.source === 'connection') },
    { title: 'לידך עכשיו', items: candidates.filter((c) => c.source === 'nearby') },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Users size={20} />
        </span>
        <h3 className="text-lg font-extrabold text-ink">קבוצה חדשה</h3>
      </div>

      <input
        autoFocus
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        placeholder="שם הקבוצה"
        className="field"
      />

      <p className="mt-5 mb-1 text-xs font-bold text-muted">
        מי מצטרף? {picked.size > 0 && <span className="text-primary">· נבחרו {picked.size}</span>}
      </p>

      {candidates.length === 0 ? (
        <p className="rounded-2xl bg-bg px-4 py-5 text-center text-sm text-muted">
          עוד אין חיבורים או אנשים לידך. אפשר ליצור קבוצה ריקה ולהוסיף אחר כך.
        </p>
      ) : (
        <div className="max-h-[38vh] overflow-y-auto">
          {sections.map(
            (s) =>
              s.items.length > 0 && (
                <div key={s.title}>
                  <p className="mt-3 mb-1.5 text-[11px] font-bold text-muted">{s.title}</p>
                  <ul className="space-y-1.5">
                    {s.items.map((c) => {
                      const on = picked.has(c.id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            onClick={() => toggle(c.id)}
                            className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-start transition-colors ${
                              on ? 'border-primary bg-primary-soft/60' : 'border-line bg-card'
                            }`}
                          >
                            <Avatar url={c.avatar_url} name={c.first_name} size={40} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold text-ink">{c.first_name}</span>
                              {c.headline && <span className="block truncate text-xs text-muted">{c.headline}</span>}
                            </span>
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                on ? 'border-primary bg-primary text-white' : 'border-line text-transparent'
                              }`}
                            >
                              <Check size={14} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
          )}
        </div>
      )}

      <button
        onClick={submit}
        disabled={!name.trim() || busy}
        className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
        יצירת קבוצה{picked.size > 0 ? ` עם ${picked.size}` : ''}
      </button>
    </div>
  );
}
