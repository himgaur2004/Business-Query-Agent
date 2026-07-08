FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Azure Functions custom handler expects the app to listen on port 80
ENV PORT=80
EXPOSE 80

# Uvicorn with auto-reload disabled in production
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80", "--workers", "2"]
