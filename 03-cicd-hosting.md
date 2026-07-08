# CI/CD & Hosting Documentation — Deployment on Azure

## 1. Overview
Matches the resume bullet: **"Deployed services in Docker containers on Azure Functions for serverless
inference with Azure Monitor alerting."** This doc covers containerization, the CI/CD pipeline, and
the serverless hosting/monitoring setup — all using free or low-cost Azure tiers where possible.

## 2. Hosting Architecture
| Component | Azure Service | Tier |
|---|---|---|
| React frontend | Azure Static Web Apps | **Free tier** |
| Node.js gateway | Azure Functions (Node runtime) | Consumption (pay-per-execution, free grant/month) |
| Python FastAPI AI service | Azure Functions (Python runtime, Docker-based custom handler) | Consumption |
| PostgreSQL | Azure Database for PostgreSQL Flexible Server | Burstable B1ms (lowest paid tier — PostgreSQL has no perpetual free tier, but this is the cheapest) |
| Monitoring | Azure Monitor + Application Insights | Free tier (first 5GB/mo ingestion) |
| Container registry | Azure Container Registry (Basic) or GitHub Container Registry (free for public repos) | — |

> **Cost tip:** If you want a fully free stack for a portfolio/demo project, swap Azure Database for
> PostgreSQL for a free **Supabase** or **Neon** Postgres instance and keep everything else on Azure's
> free tiers.

## 3. Dockerfiles

### AI service (`backend/ai-service/Dockerfile`)
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Azure Functions custom handler expects the app to listen on port 80
ENV PORT=80
EXPOSE 80

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
```

### Gateway (`backend/gateway/Dockerfile`)
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
EXPOSE 80
CMD ["node", "src/server.js"]
```

## 4. GitHub Actions — CI Pipeline
`.github/workflows/ci.yml`
```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend
      - run: npm test -- --run
        working-directory: frontend

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r backend/ai-service/requirements.txt
      - run: pip install pytest pytest-cov
      - run: pytest --cov=app backend/ai-service/tests
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/testdb
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY_TEST }}

  build-images:
    needs: [test-frontend, test-backend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build AI service image
        run: docker build -t ai-service:${{ github.sha }} backend/ai-service
      - name: Build gateway image
        run: docker build -t gateway:${{ github.sha }} backend/gateway
```

## 5. GitHub Actions — CD Pipeline
`.github/workflows/cd.yml`
```yaml
name: CD

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log in to Azure
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Log in to ACR
        run: az acr login --name ${{ secrets.ACR_NAME }}

      - name: Build & push AI service
        run: |
          docker build -t ${{ secrets.ACR_NAME }}.azurecr.io/ai-service:${{ github.sha }} backend/ai-service
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/ai-service:${{ github.sha }}

      - name: Build & push gateway
        run: |
          docker build -t ${{ secrets.ACR_NAME }}.azurecr.io/gateway:${{ github.sha }} backend/gateway
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/gateway:${{ github.sha }}

      - name: Deploy AI service to Azure Function
        uses: azure/functions-container-action@v1
        with:
          app-name: ai-service-func
          image: ${{ secrets.ACR_NAME }}.azurecr.io/ai-service:${{ github.sha }}

      - name: Deploy gateway to Azure Function
        uses: azure/functions-container-action@v1
        with:
          app-name: gateway-func
          image: ${{ secrets.ACR_NAME }}.azurecr.io/gateway:${{ github.sha }}

      - name: Deploy frontend to Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.SWA_DEPLOYMENT_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: frontend
          output_location: dist
```

## 6. Required GitHub Secrets
| Secret | Purpose |
|---|---|
| `AZURE_CREDENTIALS` | Service principal JSON for `azure/login` |
| `ACR_NAME` | Azure Container Registry name |
| `SWA_DEPLOYMENT_TOKEN` | Static Web Apps deployment token |
| `GROQ_API_KEY_TEST` | Free Groq key for running integration tests in CI |
| `DATABASE_URL` (as Function App setting, not GitHub secret) | Production Postgres connection string |

## 7. Azure Monitor & Alerting
1. Enable **Application Insights** on both Function Apps at creation time (free tier covers first 5GB/month).
2. Track custom metrics from the AI service:
   ```python
   from opencensus.ext.azure.log_exporter import AzureLogHandler
   import logging

   logger = logging.getLogger(__name__)
   logger.addHandler(AzureLogHandler(connection_string=os.environ["APPINSIGHTS_CONNECTION_STRING"]))

   logger.info("query_executed", extra={
       "custom_dimensions": {"intent": intent["intent"], "execution_ms": exec_time}
   })
   ```
3. Create **Alert Rules** in Azure Monitor:
   - Function error rate > 5% over 5 minutes → email/Slack webhook action group.
   - p95 latency > 3s → warning alert.
   - Groq API failures (tracked as custom exception) → immediate alert, since it signals the free-tier
     rate limit may have been hit.

## 8. Rollback Strategy
- Each Function App deployment is tagged with the Git SHA container image.
- Rollback = redeploy the previous SHA's image tag (`az functionapp config container set --image <prev-sha>`).
- Keep the last 5 image tags in ACR (lifecycle policy) to always have a fast rollback target.
