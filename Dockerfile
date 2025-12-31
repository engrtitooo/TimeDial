# --- Stage 1: Build Frontend ---
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# Build the React app (outputs to /app/dist)
RUN npm run build

# --- Stage 2: Serve with Python ---
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Copy built frontend from Stage 1 -> /app/dist
COPY --from=frontend-builder /app/dist ./dist

# Expose port (Cloud Run default)
EXPOSE 8080

# Run FastAPI app
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
