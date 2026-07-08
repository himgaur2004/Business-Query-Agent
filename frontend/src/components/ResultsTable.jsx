import { useState, useMemo } from "react";

const PAGE_SIZE = 20;

export default function ResultsTable({ rows }) {
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  if (!rows || rows.length === 0) {
    return (
      <div className="card mt-4 text-center py-8 text-slate-500 animate-fade-in">
        <span className="text-3xl">📊</span>
        <p className="mt-2 text-sm">No results returned</p>
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(0);
  };

  return (
    <div className="card mt-4 animate-slide-up overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300">
          Results
          <span className="ml-2 tag bg-surface-900 text-slate-400">{rows.length} rows</span>
        </h3>
        <span className="text-xs text-slate-500">
          Page {page + 1} / {totalPages}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-900 border-b border-surface-700">
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none transition-colors whitespace-nowrap"
                  aria-sort={sortCol === col ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === col && (
                      <span className="text-brand-400">{sortDir === "asc" ? "↑" : "↓"}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-surface-700/50 hover:bg-surface-700/40 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-3 text-slate-300 font-mono text-xs whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis"
                    title={String(row[col] ?? "")}
                  >
                    {row[col] === null ? (
                      <span className="text-slate-600 italic">null</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-ghost text-sm disabled:opacity-30"
            aria-label="Previous page"
          >
            ← Prev
          </button>
          <span className="text-sm text-slate-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="btn-ghost text-sm disabled:opacity-30"
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
