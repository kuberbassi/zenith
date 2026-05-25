# Stage 1: Build the React application
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Add build-time arguments for env variables
ARG VITE_API_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Copy package.json and lock files
COPY package*.json ./

# The frontend workspace does not keep its own lockfile in this repo.
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx config (optional, but good for SPA)
# We'll create a simple inline config or default for now, 
# but usually need one for React Router to work on refresh.
RUN echo 'server { \
    listen 80; \
    client_max_body_size 20M; \
    root /usr/share/nginx/html; \
    index index.html index.htm; \
    \
    location /assets/ { \
    try_files $uri =404; \
    } \
    \
    location ~ \.(js|css|png|jpg|jpeg|gif|ico|svg|json)$ { \
    try_files $uri =404; \
    } \
    \
    location / { \
    try_files $uri $uri/ /index.html; \
    } \
    \
    location /api/ { \
    proxy_pass http://backend:5001; \
    proxy_set_header Host $host; \
    proxy_set_header X-Real-IP $remote_addr; \
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
    proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
