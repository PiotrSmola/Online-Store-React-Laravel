# ---- Build stage ----
FROM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# "/" = same origin: nginx proxies /api and /storage to the backend container
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.30-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
