FROM node:18-alpine

WORKDIR /agent

COPY ./agent .
COPY ./server/src/api ./src/api
COPY ./server/src/util ./src/util
COPY ./types ./types

# Install server deps
RUN apk add --no-cache python3 make g++
RUN npm i
RUN npm run build

CMD ["node", "agent.js"]
