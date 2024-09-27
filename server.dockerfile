# FROM node:20-bullseye
FROM node:20-alpine
# FROM nginxinc/nginx-unprivileged:stable-alpine3.18

USER 0

ENV NODE_ENV production

# Install node
RUN apk add nodejs npm git

# Add the nginx apk repository
RUN printf "%s%s%s%s\n" \
    "@nginx " \
    "http://nginx.org/packages/alpine/v" \
    `egrep -o '^[0-9]+\.[0-9]+' /etc/alpine-release` \
    "/main" \
    | tee -a /etc/apk/repositories

# Get the signing key
RUN wget --output-document=/etc/apk/keys/nginx_signing.rsa.pub https://nginx.org/keys/nginx_signing.rsa.pub

# Install the otel module
RUN apk add nginx@nginx nginx-module-otel@nginx

# RUN apt update
# RUN apt install nginx g++ make python3 -y -qq

# Pull in nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf
RUN rm /etc/nginx/conf.d/default.conf

# Test the nginx configuration
RUN nginx -t -c /etc/nginx/nginx.conf

WORKDIR /app
RUN chown 1000 /app -R

USER 1000

ADD ./dist/cruiser/browser/ /app/client/
ADD ./dist/server/ /app/server/
COPY ./server/package.json /app/package.json

# Install server deps
RUN npm i --omit=dev

EXPOSE 8080

CMD ["/bin/sh", "-c", "nginx \"-g daemon off;\" & node server/primary.js"]
