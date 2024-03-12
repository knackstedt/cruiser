FROM node:20-bullseye
# FROM node:20-alpine

# RUN apk add nginx g++ make py3-pip
RUN apt update
RUN apt install nginx g++ make python3 -y -qq

WORKDIR /app

# Pull in nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf
# RUN rm /etc/nginx/conf.d/default.conf

ADD ./dist/cruiser/browser/ /app/client/
ADD ./dist/server/ /app/server/
COPY ./package.json /app/package.json

# Install server deps
RUN npm i --omit=dev

EXPOSE 8080

CMD ["/bin/bash", "-c", "service nginx start; node server/primary.js"]
