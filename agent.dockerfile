# FROM node:18-alpine
FROM oven/bun:alpine

# Add required base dependencies
RUN apk add --no-cache lrzip lrzip-extra-scripts
RUN apk add --no-cache python3 make g++ git

COPY ./agent /agent

# Remove symlinks
RUN rm /agent/types

# Restore symlinks with actual contents
# COPY ./server/src/api /agent/src/api
# COPY ./server/src/util /agent/src/util
COPY ./types /agent/types

WORKDIR /agent

# Install general agent deps
RUN bun i
RUN bun run build

EXPOSE 8080

CMD ["bun", "src/main.js"]
