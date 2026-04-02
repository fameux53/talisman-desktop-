# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
# When frontend is served behind nginx proxy (docker-compose), leave empty so
# requests go to same origin and nginx forwards them to the backend.
# For split-origin deployments, pass --build-arg VITE_API_URL=https://your-backend.url
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npx vite build

# Production stage — serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
