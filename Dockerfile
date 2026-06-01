# Dockerfile
# Stage 1: build the React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
ARG REACT_APP_DEMO_MODE=true
ARG REACT_APP_API_URL=
ENV REACT_APP_DEMO_MODE=$REACT_APP_DEMO_MODE
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# Stage 2: production backend
FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
# Copy built frontend into backend/public so Express can serve it
COPY --from=frontend-build /app/frontend/build ./public

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

CMD ["node", "index.js"]
