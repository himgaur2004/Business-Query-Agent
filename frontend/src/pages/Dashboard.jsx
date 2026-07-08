import { useState } from "react";
import QueryInput from "../components/QueryInput";
import SqlPreview from "../components/SqlPreview";
import ResultsTable from "../components/ResultsTable";
import ResultsChart from "../components/ResultsChart";
import StatusBadge from "../components/StatusBadge";
import QueryHistory from "../components/QueryHistory";

function SummaryCard({ summary }) {
  if (!summary) return null;
  return (
    <div className="card mt-4 animate-slide-up border-l-2 border-brand-500">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>🤖</span>
        <div>
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
            AI Summary
          </p>
          <p className="text-slate-200 text-sm leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-6 space-y-4 animate-fade-in">
      <div className="h-24 rounded-2xl shimmer" />
      <div className="h-48 rounded-2xl shimmer" />
      <div className="h-64 rounded-2xl shimmer" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center animate-fade-in px-8">
      <div className="w-20 h-20 rounded-3xl bg-brand-950 border border-brand-800 flex items-center justify-center text-4xl mb-5">
        🔍
      </div>
      <h2 className="text-lg font-semibold text-slate-200 mb-2">
        Ask anything about your data
      </h2>
      <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
        Type a natural-language question. The AI will classify your intent, write the SQL, execute it,
        and give you a plain-English answer — no SQL knowledge needed.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-md">
        {[
          "Top 5 products by revenue last quarter",
          "How many orders are pending?",
          "Show customer churn rate by month",
        ].map((q) => (
          <div
            key={q}
            className="px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-sm text-slate-400 text-left"
          >
            💬 {q}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [result, setResult] = useState(null);
  const [isPending, setIsPending] = useState(false);

  return (
    <div className="flex h-screen bg-surface-900 text-slate-100 overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-72 flex-shrink-0 glass-strong border-r border-surface-700 overflow-hidden">
        <div className="p-5 border-b border-surface-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-lg">
              ⚡
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Query Agent</h1>
              <p className="text-xs text-slate-500">Business Intelligence AI</p>
            </div>
          </div>
        </div>
        <QueryHistory onSelectQuery={() => {}} />
      </div>

      {/* ── Main Panel ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex-shrink-0 px-8 py-5 border-b border-surface-700 glass">
          <QueryInput
            onResult={(data) => { setResult(data); setIsPending(false); }}
            onPending={() => { setResult(null); setIsPending(true); }}
          />
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {isPending && <LoadingState />}

          {!isPending && !result && <EmptyState />}

          {!isPending && result && (
            <div className="max-w-5xl mx-auto animate-fade-in">
              {/* Intent badge */}
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge intent={result.intent} />
                {result.rows?.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* AI Summary */}
              <SummaryCard summary={result.summary} />

              {/* Chart (auto) */}
              <ResultsChart rows={result.rows} />

              {/* Table */}
              <ResultsTable rows={result.rows} />

              {/* SQL */}
              <SqlPreview sql={result.generated_sql} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
