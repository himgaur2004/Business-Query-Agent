# Business Query Agent

> **Resume bullet:** *"Node.js/Python FastAPI microservices backend for multi-step intent classification and SQL generation, consumed via a React dashboard, deployed in Docker containers on Azure Functions — reducing manual lookup time by 60%."*

A cloud-native AI system that lets business users ask natural-language questions and get instant SQL-backed answers with plain-English summaries. No SQL knowledge required.

---

## Architecture

```
Browser (React + Vite)
   ↓  POST /api/query
Node.js Gateway (Express)          ← auth, rate-limit, routing
   ↓  HTTP
Python FastAPI AI Service
   ├─ [1] Intent Classifier         ← llama-3.1-8b-instant (Groq)
   ├─ [2] SQL Generator             ← llama-3.3-70b-versatile (Groq)
   ├─ [3] Safety Validator          ← blocks DDL/DML
   ├─ [4] Query Executor            ← PostgreSQL read replica
   └─ [5] Summarizer                ← plain-English answer
   ↓  logs to
PostgreSQL (query_log table)
```

**Hosting:** Azure Static Web Apps (frontend) + Azure Functions Container (backend services) + Azure Monitor.

---

## Quick Start — Local Dev

### Prerequisites
- Node.js 20+, Python 3.11+, Docker + Docker Compose
- Free [Groq API key](https://console.groq.com) (5 minutes to get one)

### 1. Clone and set up environment variables

```bash
git clone <your-repo-url>
cd "cloud native business query"

# Copy env examples
cp frontend/.env.example frontend/.env
cp backend/gateway/.env.example backend/gateway/.env
cp backend/ai-service/.env.example backend/ai-service/.env

# Edit backend/ai-service/.env and add your GROQ_API_KEY
```

### 2. Run with Docker Compose (backend + DB)

```bash
# Set your Groq key (or add to .env file)
export GROQ_API_KEY=gsk_your_key_here

docker-compose up --build
```

This starts:
- PostgreSQL on `localhost:5432`
- AI service on `http://localhost:8000`
- Gateway on `http://localhost:3001`

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```

### 4. Try it out

Open `http://localhost:5173` and ask questions like:
- *"What were our top 5 products by revenue last quarter?"*
- *"How many orders are pending?"*
- *"Show me customer count by region"*

---

## Running Tests

```bash
# Frontend unit tests (Vitest)
cd frontend && npm test

# Gateway tests (Jest + supertest)
cd backend/gateway && npm test

# AI service tests (pytest)
cd backend/ai-service
pip install -r requirements.txt
pytest --cov=app tests/ -v

# E2E (Playwright) — requires local stack running
npx playwright install chromium
npx playwright test
```

---

## Project Structure

```
.
├── frontend/                    # React 18 + Vite + Tailwind
│   └── src/
│       ├── components/          # QueryInput, SqlPreview, ResultsTable, ResultsChart…
│       ├── hooks/               # useQueryAgent (React Query)
│       ├── pages/               # Dashboard, Login
│       └── api/                 # Axios instance
├── backend/
│   ├── gateway/                 # Node.js/Express — auth, rate-limit, proxy
│   └── ai-service/              # Python/FastAPI — intent→SQL→execute→summarize
│       ├── app/
│       │   ├── intent_classifier.py
│       │   ├── sql_generator.py
│       │   ├── executor.py
│       │   ├── summarizer.py
│       │   └── schema_cache.py
│       └── tests/
│           ├── test_sql_generator.py
│           ├── test_intent_classifier.py
│           └── integration/
│               └── test_query_pipeline.py
├── e2e/                         # Playwright E2E tests
├── .github/workflows/           # CI (test + build) + CD (deploy to Azure)
├── docker-compose.yml           # Local dev: postgres + ai-service + gateway
└── README.md
```

---

## Environment Variables

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Gateway base URL (e.g. `https://gateway-func.azurewebsites.net`) |
| `VITE_AZURE_AD_CLIENT_ID` | Azure AD app client ID (leave blank for dev mode) |
| `VITE_AZURE_AD_TENANT_ID` | Azure AD tenant ID (leave blank for dev mode) |

### AI Service (`backend/ai-service/.env`)
| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Free key from [console.groq.com](https://console.groq.com) |
| `DATABASE_URL` | PostgreSQL primary connection string |
| `DATABASE_READ_REPLICA_URL` | PostgreSQL read replica (falls back to primary) |
| `APPINSIGHTS_CONNECTION_STRING` | Azure Application Insights (optional) |

### Gateway (`backend/gateway/.env`)
| Variable | Description |
|---|---|
| `AI_SERVICE_URL` | Internal URL of FastAPI service |
| `DATABASE_URL` | PostgreSQL (for query history) |
| `AZURE_AD_TENANT_ID` | Azure AD (leave blank for dev mode) |
| `AZURE_AD_CLIENT_ID` | Azure AD (leave blank for dev mode) |

---

## CI/CD

| Trigger | Pipeline |
|---|---|
| PR to `main` | CI: lint, test all layers, build Docker images |
| Push to `main` | CD: push images to ACR, deploy to Azure Functions + Static Web Apps |

**Required GitHub Secrets for CD:**
- `AZURE_CREDENTIALS` — service principal JSON
- `ACR_NAME` — Azure Container Registry name
- `SWA_DEPLOYMENT_TOKEN` — Static Web Apps deployment token
- `GROQ_API_KEY_TEST` — Groq key for CI integration tests

---

## Rollback

Each deployment is tagged with its Git SHA image. To roll back:

```bash
az functionapp config container set \
  --name ai-service-func \
  --resource-group <rg> \
  --image <ACR_NAME>.azurecr.io/ai-service:<previous-sha>
```

---

## Security Notes

- The SQL safety validator (`validate_sql`) **blocks all DDL/DML** — only `SELECT` statements can be executed.
- The gateway enforces a 100 req/15-min rate limit per IP.
- JWT verification (Azure AD RS256) is enforced in production; bypassed transparently in dev mode.
- PostgreSQL query execution uses a read-only replica, never the primary write connection.
