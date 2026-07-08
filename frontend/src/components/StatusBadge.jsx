const INTENT_CONFIG = {
  sales_report: { label: "Sales Report", color: "bg-emerald-900/60 text-emerald-300 border-emerald-700/50" },
  inventory_check: { label: "Inventory Check", color: "bg-amber-900/60 text-amber-300 border-amber-700/50" },
  customer_lookup: { label: "Customer Lookup", color: "bg-blue-900/60 text-blue-300 border-blue-700/50" },
  financial_summary: { label: "Financial Summary", color: "bg-purple-900/60 text-purple-300 border-purple-700/50" },
  unknown: { label: "Unknown", color: "bg-surface-700 text-slate-400 border-surface-600" },
};

function confidenceColor(confidence) {
  if (confidence >= 0.85) return "text-emerald-400";
  if (confidence >= 0.65) return "text-amber-400";
  return "text-red-400";
}

/**
 * Displays classified intent name + confidence score.
 * @param {object} props
 * @param {{ intent: string, confidence?: number }} props.intent
 */
export default function StatusBadge({ intent }) {
  if (!intent) return null;

  const key = intent.intent ?? "unknown";
  const config = INTENT_CONFIG[key] ?? INTENT_CONFIG.unknown;
  const confidence = intent.confidence ?? null;

  return (
    <div
      role="status"
      aria-label={`Intent: ${config.label}${confidence != null ? `, confidence ${Math.round(confidence * 100)}%` : ""}`}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${config.color} animate-fade-in`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {config.label}
      {confidence != null && (
        <span className={`font-mono ${confidenceColor(confidence)}`}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}
