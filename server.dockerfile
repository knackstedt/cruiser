# FROM node:20-bullseye
# FROM node:20-alpine
FROM nginxinc/nginx-unprivileged:stable-alpine3.18

USER 0

ENV NODE_ENV production

# Install node
RUN apk add nodejs npm

# RUN apt update
# RUN apt install nginx g++ make python3 -y -qq

# Pull in nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf
RUN rm /etc/nginx/conf.d/default.conf


WORKDIR /app
RUN chown 101 /app -R
USER 101

ADD ./dist/cruiser/browser/ /app/client/
ADD ./dist/server/ /app/server/
COPY ./server/package.json /app/package.json

# Install server deps
RUN npm i --omit=dev

EXPOSE 8080

CMD ["/bin/sh", "-c", "nginx -g daemon off; node server/primary.js"]
