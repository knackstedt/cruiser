FROM node:20-alpine

RUN apk add nginx g++ make py3-pip

RUN npm i -g pm2
# RUN service nginx enable

WORKDIR /app

# Pull in nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf
# RUN rm /etc/nginx/conf.d/default.conf

ADD ./dist/dot-ops/browser/ /app/client/
ADD ./dist/server/src/ /app/server/
COPY ./package.json /app/package.json
# COPY postinstall.sh /app/postinstall.sh
COPY ./ecosystem.config.js /app/ecosystem.config.js

# Install server deps
ENV CXXFLAGS="--std=c++17"
RUN npm i --omit=dev

EXPOSE 80

CMD ["/bin/bash", "-c", "nginx start; pm2-runtime ecosystem.config.js"]
