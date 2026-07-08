# Frontend Documentation — Business Query Agent Dashboard

## 1. Overview
The frontend is a **React** single-page application that lets business users type natural-language
questions (e.g. *"What were our top 5 products by revenue last quarter?"*) and see the AI agent's
generated SQL, query results, and a plain-English answer — without needing to know SQL themselves.

**Goal it supports from the resume bullet:** *"consumed via a React dashboard, reducing manual lookup
time by 60%."*

## 2. Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | React 18 + Vite | Fast dev server, simple build pipeline |
| Styling | Tailwind CSS | Rapid, consistent UI without custom CSS overhead |
| State | React Query (TanStack Query) | Caching + retry logic for API calls |
| Charts | Recharts | Lightweight, good for tabular/business data |
| Auth | Azure AD B2C (MSAL.js) | Matches Azure-hosted backend |
| HTTP | Axios | Interceptors for auth token + error handling |

## 3. Project Structure
```
frontend/
├── src/
│   ├── api/
│   │   └── queryClient.js        # Axios instance + interceptors
│   ├── components/
│   │   ├── QueryInput.jsx        # NL question input box
│   │   ├── SqlPreview.jsx        # Shows generated SQL (collapsible)
│   │   ├── ResultsTable.jsx      # Paginated results grid
│   │   ├── ResultsChart.jsx      # Auto chart when result is numeric/time-series
│   │   ├── QueryHistory.jsx      # Sidebar of past queries (from PostgreSQL log)
│   │   └── StatusBadge.jsx       # Shows intent-classification confidence
│   ├── hooks/
│   │   └── useQueryAgent.js      # Wraps React Query around /api/query
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   └── Login.jsx
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

## 4. Core User Flow
1. User types a question in `QueryInput`.
2. Frontend calls `POST /api/query` on the FastAPI gateway with `{ question, sessionId }`.
3. Backend streams back (via SSE or polling):
   - `intent` (e.g. `sales_report`, `inventory_check`)
   - `generated_sql`
   - `rows` (query result)
   - `summary` (plain-English answer from the LLM)
4. UI renders `SqlPreview` (collapsed by default), `ResultsTable`/`ResultsChart`, and the summary text.
5. Query + result metadata is appended to `QueryHistory` (pulled from the backend's PostgreSQL log table).

## 5. Example: `useQueryAgent.js`
```javascript
import { useMutation } from "@tanstack/react-query";
import apiClient from "../api/queryClient";

export function useQueryAgent() {
  return useMutation({
    mutationFn: async (question) => {
      const { data } = await apiClient.post("/api/query", { question });
      return data; // { intent, generated_sql, rows, summary }
    },
  });
}
```

## 6. Example: `QueryInput.jsx`
```jsx
import { useState } from "react";
import { useQueryAgent } from "../hooks/useQueryAgent";

export default function QueryInput() {
  const [question, setQuestion] = useState("");
  const { mutate, data, isPending, error } = useQueryAgent();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (question.trim()) mutate(question);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full">
      <input
        className="flex-1 border rounded-lg px-4 py-2"
        placeholder="Ask a business question..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {isPending ? "Thinking..." : "Ask"}
      </button>
      {error && <p className="text-red-500 text-sm">{error.message}</p>}
    </form>
  );
}
```

## 7. Environment Variables (`.env.example`)
```
VITE_API_BASE_URL=https://<your-func-app>.azurewebsites.net
VITE_AZURE_AD_CLIENT_ID=<client-id>
VITE_AZURE_AD_TENANT_ID=<tenant-id>
```

## 8. Build & Run Locally
```bash
npm install
npm run dev        # local dev server (http://localhost:5173)
npm run build      # production build → dist/
```

## 9. Deployment
The `dist/` build output is deployed as an **Azure Static Web App**, which is free-tier eligible and
integrates natively with GitHub Actions (see the CI/CD document). Static Web Apps also handle
routing to the FastAPI backend via a configured API proxy, avoiding CORS issues.

## 10. Accessibility & UX Notes
- SQL preview is collapsed by default so non-technical users aren't intimidated, but is one click away
  for analysts who want to verify/copy the query.
- Confidence badge (`StatusBadge`) surfaces the intent-classification confidence score so users know
  when to double-check an answer — improves trust in the "60% time saved" claim by making failures visible
  rather than silent.
