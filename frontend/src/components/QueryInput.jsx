import { useState, useRef, useEffect } from "react";
import { useQueryAgent } from "../hooks/useQueryAgent";

const EXAMPLE_QUESTIONS = [
  "What were our top 5 products by revenue last quarter?",
  "How many orders were placed yesterday?",
  "Show me customer lifetime value by region",
  "Which inventory items are running low?",
  "Compare monthly sales for this year vs last year",
];

export default function QueryInput({ onResult, onPending }) {
  const [question, setQuestion] = useState("");
  const [showExamples, setShowExamples] = useState(false);
  const inputRef = useRef(null);
  const { mutate, isPending, error, reset } = useQueryAgent();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isPending) return;
    reset();
    onPending?.();
    mutate(trimmed, {
      onSuccess: (data) => onResult?.(data),
    });
  };

  const handleExample = (q) => {
    setQuestion(q);
    setShowExamples(false);
    inputRef.current?.focus();
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <input
            id="query-input"
            ref={inputRef}
            aria-label="Business question input"
            className="input-field pr-10 text-sm"
            placeholder="Ask a business question…"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (e.target.value === "") reset();
            }}
            onFocus={() => setShowExamples(true)}
            onBlur={() => setTimeout(() => setShowExamples(false), 150)}
            disabled={isPending}
            autoComplete="off"
          />
          {question && (
            <button
              type="button"
              aria-label="Clear input"
              onClick={() => { setQuestion(""); reset(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              ✕
            </button>
          )}

          {/* Example suggestions dropdown */}
          {showExamples && !question && (
            <div
              className="absolute top-full left-0 right-0 mt-2 glass rounded-xl z-50 overflow-hidden shadow-2xl"
              onMouseDown={(e) => e.preventDefault()}
            >
              <p className="px-4 py-2.5 text-xs text-slate-500 font-medium uppercase tracking-wider border-b border-surface-700">
                Example questions
              </p>
              <ul>
                {EXAMPLE_QUESTIONS.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => handleExample(q)}
                      className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-surface-700 hover:text-white transition-colors"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          id="query-submit-btn"
          type="submit"
          disabled={isPending || !question.trim()}
          className="btn-primary flex items-center gap-2 min-w-[100px] justify-center"
          aria-busy={isPending}
        >
          {isPending ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Thinking…
            </>
          ) : (
            <>
              <span aria-hidden>⚡</span> Ask
            </>
          )}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="mt-3 px-4 py-3 bg-red-900/40 border border-red-700/50 rounded-xl text-sm text-red-300 animate-fade-in"
        >
          {error.message}
        </div>
      )}
    </div>
  );
}
