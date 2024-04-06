# FROM node:20-bullseye
FROM node:20-alpine

ENV NODE_ENV production

RUN apk add nginx
# RUN apt update
# RUN apt install nginx g++ make python3 -y -qq


# Pull in nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf
# RUN rm /etc/nginx/conf.d/default.conf


WORKDIR /app
RUN chown node /app -R
USER node


ADD ./dist/cruiser/browser/ /app/client/
ADD ./dist/server/ /app/server/
COPY ./server/package.json /app/package.json

# Install server deps
RUN npm i --omit=dev

EXPOSE 8080

CMD ["/bin/sh", "-c", "rc-service nginx start; node server/primary.js"]
