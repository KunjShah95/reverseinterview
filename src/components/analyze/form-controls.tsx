import { useState } from "react";
import { Loader2, Upload } from "lucide-react";

export function FileDrop({
  accept,
  label,
  hint,
  busy,
  onFile,
}: {
  accept: string;
  label: string;
  hint: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex flex-col items-center justify-center text-center cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
        dragging ? "border-heading bg-heading/5" : "border-ink/20 bg-cream/40 hover:bg-cream/60"
      }`}
    >
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {busy ? (
        <Loader2 size={28} className="animate-spin text-ink/60" />
      ) : (
        <Upload size={28} className="text-ink/60" />
      )}
      <span className="mt-3 text-sm font-medium text-ink">{label}</span>
      <span className="mt-1 text-xs text-body/80">{hint}</span>
    </label>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink/15 bg-cream/40 px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-heading/40 focus:border-heading/40"
      />
    </label>
  );
}
