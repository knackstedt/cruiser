FROM node:20-bullseye
# FROM node:20-alpine

# RUN apk add nginx g++ make py3-pip
RUN apt update
RUN apt install nginx g++ make python3 -y -qq

RUN npm i -g pm2
# RUN service nginx enable

WORKDIR /app

# Pull in nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf
# RUN rm /etc/nginx/conf.d/default.conf

ADD ./dist/cruiser/browser/ /app/client/
ADD ./dist/server/src/ /app/server/
COPY ./package.json /app/package.json
# COPY postinstall.sh /app/postinstall.sh
COPY ./ecosystem.config.js /app/ecosystem.config.js

# Install server deps
RUN npm i --omit=dev

EXPOSE 8080

CMD ["/bin/bash", "-c", "nginx start; pm2-runtime ecosystem.config.js"]
