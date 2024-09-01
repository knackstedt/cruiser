FROM node:22-alpine
# FROM oven/bun:alpine

# Add required base dependencies
RUN apk add --no-cache lrzip lrzip-extra-scripts
RUN apk add --no-cache python3 make g++ git

COPY ./agent /agent

# Remove symlinks
RUN rm /agent/src/types

# Restore symlinks with actual contents
COPY ./types /agent/src/types

WORKDIR /agent

RUN chown /agent node -R

USER 1000

# Install general agent deps
RUN npm i
RUN npm run build:docker

EXPOSE 8080

CMD ["node", "dist/main.js"]
