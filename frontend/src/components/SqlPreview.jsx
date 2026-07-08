import { useState } from "react";

export default function SqlPreview({ sql }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!sql) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card animate-fade-in mt-4">
      <button
        id="sql-preview-toggle"
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left group"
        aria-expanded={open}
        aria-controls="sql-preview-code"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
          <span className="text-brand-400 font-mono text-xs px-2 py-0.5 bg-brand-950 rounded">SQL</span>
          Generated Query
          <span className="text-slate-500 text-xs">(click to {open ? "hide" : "expand"})</span>
        </span>
        <span
          className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open && (
        <div id="sql-preview-code" className="mt-4 animate-slide-up">
          <div className="relative">
            <pre className="bg-surface-900 rounded-xl p-4 overflow-x-auto text-sm font-mono text-emerald-300 leading-relaxed border border-surface-700">
              <code>{sql}</code>
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy SQL to clipboard"
              className="absolute top-3 right-3 px-3 py-1 bg-surface-700 hover:bg-surface-600 text-xs text-slate-300 hover:text-white rounded-lg transition-all"
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
