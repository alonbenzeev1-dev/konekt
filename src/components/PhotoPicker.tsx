import { useRef } from 'react';
import { Camera } from 'lucide-react';

interface Props {
  preview: string | null;
  onPick: (file: File) => void;
  size?: number;
  label?: string;
}

export function PhotoPicker({ preview, onPick, size = 120, label = 'החלפת תמונה' }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative rounded-full"
        style={{ width: size, height: size }}
        aria-label={label}
      >
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-line bg-primary-soft">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Camera size={size * 0.26} className="text-primary" strokeWidth={1.6} />
          )}
        </span>
        <span className="absolute bottom-1 left-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-cta text-white shadow">
          <Camera size={16} />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
