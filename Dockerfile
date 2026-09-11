# Stage 1: Build the frontend with Vite
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Build the FastAPI backend and serve the static files
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies if any
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend static files to a directory the backend can serve
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Expose port (Cloud Run sets PORT env var)
ENV PORT=8080
EXPOSE 8080

# Command to run uvicorn
CMD exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}
