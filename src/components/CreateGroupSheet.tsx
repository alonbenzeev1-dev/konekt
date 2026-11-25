import { useState } from 'react';
import { Check, Loader2, MapPin, UserPlus, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';
import { toast } from '../lib/notify';
import { MAX_GROUP_MEMBERS } from '../hooks/useGroups';

export interface GroupCandidate {
  id: string;
  first_name: string;
  headline: string | null;
  avatar_url: string | null;
  source: 'connection' | 'nearby';
}

type Result = { error: string | null };

/** Server errors → something a student can act on. */
export function groupErrorText(error: string, fallback: string): string {
  if (error.includes('too many')) return `החדר מלא (עד ${MAX_GROUP_MEMBERS} חברים)`;
  if (error.includes('unavailable')) return 'מישהו שבחרתם כבר לא זמין (לא לידך ולא מחובר). נסו בלעדיו.';
  return fallback;
}

function usePicker() {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return { picked, toggle };
}

/** Checkbox list split into connections / people nearby. `limit` caps how many can be ticked. */
function CandidateList({
  candidates,
  picked,
  onToggle,
  limit,
}: {
  candidates: GroupCandidate[];
  picked: Set<string>;
  onToggle: (id: string) => void;
  limit?: number;
}) {
  const sections = [
    { title: 'החיבורים שלי', items: candidates.filter((c) => c.source === 'connection') },
    { title: 'לידך עכשיו', items: candidates.filter((c) => c.source === 'nearby') },
  ];
  const full = limit != null && picked.size >= limit;
  return (
    <div className="max-h-[38vh] overflow-y-auto">
      {sections.map(
        (s) =>
          s.items.length > 0 && (
            <div key={s.title}>
              <p className="mt-3 mb-1.5 text-[11px] font-bold text-muted">{s.title}</p>
              <ul className="space-y-1.5">
                {s.items.map((c) => {
                  const on = picked.has(c.id);
                  const blocked = full && !on;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={blocked}
                        onClick={() => onToggle(c.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-start transition-colors disabled:opacity-45 ${
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
  );
}

// ---------------------------------------------------------------------------

interface CreateProps {
  open: boolean;
  onClose: () => void;
  candidates: GroupCandidate[];
  onCreate: (name: string, memberIds: string[], extras: { description: string; location: string }) => Promise<Result>;
}

export function CreateGroupSheet({ open, onClose, candidates, onCreate }: CreateProps) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <CreateGroupForm candidates={candidates} onCreate={onCreate} />
    </BottomSheet>
  );
}

function CreateGroupForm({ candidates, onCreate }: Pick<CreateProps, 'candidates' | 'onCreate'>) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const { picked, toggle } = usePicker();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const { error } = await onCreate(name, [...picked], { description, location });
    setBusy(false);
    if (error) toast(groupErrorText(error, 'לא הצלחנו ליצור את הקבוצה'), 'error');
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Users size={20} />
        </span>
        <h3 className="text-lg font-extrabold text-ink">קבוצה / חדר חדש</h3>
      </div>

      <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="שם הקבוצה או החדר" className="field" aria-label="שם" />
      <div className="relative mt-2.5">
        <MapPin size={16} className="pointer-events-none absolute top-1/2 end-3.5 -translate-y-1/2 text-muted" />
        <input
          value={location}
          maxLength={40}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="איפה? (לא חובה) למשל: בניין רקנאטי"
          className="field !pe-10"
          aria-label="מיקום"
        />
      </div>
      <textarea
        value={description}
        maxLength={160}
        rows={2}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="תיאור קצר (לא חובה): על מה החדר?"
        className="field mt-2.5 resize-none"
        aria-label="תיאור"
      />

      <p className="mt-5 mb-1 text-xs font-bold text-muted">
        מי מצטרף? {picked.size > 0 && <span className="text-primary">· נבחרו {picked.size}</span>}
      </p>

      {candidates.length === 0 ? (
        <p className="rounded-2xl bg-bg px-4 py-5 text-center text-sm text-muted">
          עוד אין חיבורים או אנשים לידך. אפשר ליצור קבוצה ריקה ולהוסיף אחר כך.
        </p>
      ) : (
        <CandidateList candidates={candidates} picked={picked} onToggle={toggle} limit={MAX_GROUP_MEMBERS - 1} />
      )}

      <button
        onClick={submit}
        disabled={!name.trim() || busy}
        className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
        יצירה{picked.size > 0 ? ` עם ${picked.size}` : ''}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface AddProps {
  open: boolean;
  onClose: () => void;
  /** Candidates who are not already in the group. */
  candidates: GroupCandidate[];
  /** How many more people fit (30 minus current members). */
  slots: number;
  onAdd: (memberIds: string[]) => Promise<Result>;
}

export function AddMembersSheet({ open, onClose, candidates, slots, onAdd }: AddProps) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <AddMembersForm candidates={candidates} slots={slots} onAdd={onAdd} onClose={onClose} />
    </BottomSheet>
  );
}

function AddMembersForm({ candidates, slots, onAdd, onClose }: Omit<AddProps, 'open'>) {
  const { picked, toggle } = usePicker();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!picked.size || busy) return;
    setBusy(true);
    const { error } = await onAdd([...picked]);
    setBusy(false);
    if (error) toast(groupErrorText(error, 'לא הצלחנו להוסיף'), 'error');
    else onClose();
  };

  return (
    <div>
      <div className="mb-1 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <UserPlus size={20} />
        </span>
        <h3 className="text-lg font-extrabold text-ink">הוספת משתתפים</h3>
      </div>
      <p className="mb-1 text-xs text-muted">
        {slots > 0 ? `אפשר להוסיף עוד ${slots} (עד ${MAX_GROUP_MEMBERS} בחדר)` : `החדר מלא (${MAX_GROUP_MEMBERS} חברים)`}
        {picked.size > 0 && <span className="font-bold text-primary"> · נבחרו {picked.size}</span>}
      </p>

      {candidates.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-bg px-4 py-5 text-center text-sm text-muted">
          אין עכשיו מי להוסיף. אפשר להוסיף חיבורים, או אנשים שנמצאים לידך כשהם גלויים בסביבה.
        </p>
      ) : (
        <CandidateList candidates={candidates} picked={picked} onToggle={toggle} limit={slots} />
      )}

      <button
        onClick={submit}
        disabled={!picked.size || busy}
        className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
        הוספה{picked.size > 0 ? ` (${picked.size})` : ''}
      </button>
    </div>
  );
}
