import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Auto-chart: detects if rows have at least one string column (label)
 * and at least one numeric column (value). Shows bar chart by default,
 * line chart when the label column looks like dates.
 */
function detectChartType(rows) {
  if (!rows || rows.length < 2) return null;
  const keys = Object.keys(rows[0]);
  const labelKey = keys.find((k) => typeof rows[0][k] === "string");
  const valueKeys = keys.filter((k) => typeof rows[0][k] === "number");

  if (!labelKey || valueKeys.length === 0) return null;

  // Heuristic: if label looks like a date, use line chart
  const looksLikeDate = /date|month|year|week|day|period|time/i.test(labelKey);
  return { labelKey, valueKeys, type: looksLikeDate ? "line" : "bar" };
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

const tooltipStyle = {
  contentStyle: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    fontSize: "12px",
    color: "#f1f5f9",
  },
  cursor: { fill: "rgba(59,130,246,0.08)" },
};

export default function ResultsChart({ rows }) {
  const config = detectChartType(rows);
  if (!config) return null;

  const { labelKey, valueKeys, type } = config;

  return (
    <div className="card mt-4 animate-slide-up">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="text-brand-400">📈</span> Chart View
        <span className="tag bg-surface-900 text-slate-500 text-xs">auto-detected</span>
      </h3>

      <ResponsiveContainer width="100%" height={280}>
        {type === "line" ? (
          <LineChart data={rows} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={labelKey} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
            {valueKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={rows} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={labelKey} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
            {valueKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
