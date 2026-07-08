import { useQueryHistory } from "../hooks/useQueryAgent";

function timeAgo(dateStr) {
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const INTENT_COLORS = {
  sales_report: "text-emerald-400 bg-emerald-950",
  inventory_check: "text-amber-400 bg-amber-950",
  customer_lookup: "text-blue-400 bg-blue-950",
  financial_summary: "text-purple-400 bg-purple-950",
  unknown: "text-slate-400 bg-surface-900",
};

export default function QueryHistory({ onSelectQuery }) {
  const { data: history, isLoading, isError } = useQueryHistory();

  return (
    <aside className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Query History
        </h2>
        {history?.length > 0 && (
          <span className="tag bg-surface-900 text-slate-500">{history.length}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl shimmer" />
            ))}
          </div>
        )}

        {isError && (
          <p className="p-4 text-xs text-slate-500 italic">
            History unavailable — backend not connected
          </p>
        )}

        {!isLoading && !isError && (!history || history.length === 0) && (
          <div className="p-4 text-center">
            <span className="text-3xl">🕐</span>
            <p className="mt-2 text-xs text-slate-500">No queries yet</p>
          </div>
        )}

        <ul className="p-2 space-y-1">
          {(history ?? []).map((item) => {
            const intent = item.intent?.intent ?? "unknown";
            const colorClass = INTENT_COLORS[intent] ?? INTENT_COLORS.unknown;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectQuery?.(item.question)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-surface-700 transition-colors group"
                  title={item.question}
                >
                  <p className="text-sm text-slate-300 group-hover:text-white line-clamp-2 leading-snug">
                    {item.question}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`tag text-[10px] ${colorClass}`}>{intent}</span>
                    <span className="text-[10px] text-slate-600">{timeAgo(item.created_at)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
