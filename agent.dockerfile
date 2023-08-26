FROM node:18-alpine

COPY ./agent /agent

# Remove symlinks
RUN rm /agent/src/api /agent/src/util /agent/types

# Restore symlinks with actual contents
COPY ./server/src/api /agent/src/api
COPY ./server/src/util /agent/src/util
COPY ./types /agent/types

WORKDIR /agent

# Install server deps
RUN apk add --no-cache python3 make g++
RUN npm i
RUN npm run build

CMD ["node", "dist/main.js"]
