# FROM node:20-bullseye
# FROM node:20-alpine
FROM nginxinc/nginx-unprivileged:stable-alpine3.18

ENV NODE_VERSION v20.12.1
ENV NODE_ENV production

# Install specified version of node
ENV NODE_PACKAGE_URL https://unofficial-builds.nodejs.org/download/release/$NODE_VERSION/node-$NODE_VERSION-linux-x64-musl.tar.gz
RUN apk add libstdc++
WORKDIR /opt
RUN wget $NODE_PACKAGE_URL
RUN mkdir -p /opt/nodejs
RUN tar -zxvf *.tar.gz --directory /opt/nodejs --strip-components=1
RUN rm *.tar.gz
RUN ln -s /opt/nodejs/bin/node /usr/local/bin/node
RUN ln -s /opt/nodejs/bin/npm /usr/local/bin/npm
RUN apk del libstdc++

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
