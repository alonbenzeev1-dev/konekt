import { useState } from 'react';
import { BarChart3, Loader2, Plus, X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { toast } from '../lib/notify';

const Q_MAX = 80;
const OPT_MAX = 40;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

/** "סקר מהיר": a question (up to 80) and 2-4 options (up to 40 each). */
export function PollSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (question: string, options: string[]) => Promise<{ error: string | null }> }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <PollForm onCreate={onCreate} onClose={onClose} />
    </BottomSheet>
  );
}

function PollForm({ onCreate, onClose }: { onCreate: (q: string, o: string[]) => Promise<{ error: string | null }>; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim().length > 0 && filled.length >= MIN_OPTIONS;

  const setOption = (i: number, v: string) => setOptions((prev) => prev.map((o, n) => (n === i ? v : o)));

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const { error } = await onCreate(question.trim(), filled);
    setBusy(false);
    if (error) toast('לא הצלחנו ליצור את הסקר. נסו שוב.', 'error');
    else onClose();
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-cta">
          <BarChart3 size={20} />
        </span>
        <h3 className="text-lg font-extrabold text-ink">סקר מהיר</h3>
      </div>

      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink">
          <span>השאלה</span>
          <span dir="ltr" className="font-normal text-muted tabular-nums">{question.length}/{Q_MAX}</span>
        </span>
        <input
          autoFocus
          value={question}
          maxLength={Q_MAX}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="למשל: מתי נפגשים ללמוד?"
          className="field"
        />
      </label>

      <p className="mt-4 mb-1.5 text-xs font-bold text-ink">אפשרויות (2 עד 4)</p>
      <ul className="space-y-2">
        {options.map((o, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              value={o}
              maxLength={OPT_MAX}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`אפשרות ${i + 1}`}
              aria-label={`אפשרות ${i + 1}`}
              className="field min-w-0 flex-1"
            />
            {options.length > MIN_OPTIONS && (
              <button
                type="button"
                aria-label={`הסרת אפשרות ${i + 1}`}
                onClick={() => setOptions((prev) => prev.filter((_, n) => n !== i))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted active:bg-bg"
              >
                <X size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => setOptions((prev) => [...prev, ''])}
          className="mt-2 flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-cta-press active:bg-primary-soft"
        >
          <Plus size={16} /> הוסף אפשרות
        </button>
      )}

      <button onClick={submit} disabled={!valid || busy} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 text-base">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <BarChart3 size={18} />}
        פרסום הסקר
      </button>
      <p className="mt-2 text-center text-[11px] text-muted">כל חברי החדר יכולים להצביע, ואפשר לשנות הצבעה.</p>
    </div>
  );
}
