# FROM node:20-bullseye
# FROM node:20-alpine
FROM nginx:stable-alpine3.20-otel
# FROM nginxinc/nginx-unprivileged:stable-alpine3.18

USER 0

ENV NODE_ENV production

# Install node
RUN apk add nodejs npm git nginx

# Pull in nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf
RUN rm /etc/nginx/conf.d/default.conf

# Test the nginx configuration
RUN nginx -t -c /etc/nginx/nginx.conf

WORKDIR /app
RUN chown -R 101:101 "/app"
RUN mkdir /var/cache/nginx/.npm
RUN chown -R 101:101 "/var/cache/nginx/.npm"
USER 101

ADD ./dist/cruiser/browser/ /app/client/
ADD ./dist/server/ /app/server/
COPY ./server/package.json /app/package.json

# Install server deps
RUN npm i --omit=dev

EXPOSE 8080

CMD ["/bin/sh", "-c", "nginx \"-g daemon off;\" & node server/primary.js"]
