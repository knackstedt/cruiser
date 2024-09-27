FROM node:20-alpine as build
# FROM oven/bun:alpine

# Add required build dependencies
RUN apk add --no-cache python3 make g++ git

COPY ./agent /agent

# Remove symlinks
RUN rm /agent/src/types

# Restore symlinks with actual contents
COPY ./types /agent/src/types

WORKDIR /agent

# Install and build the agent codebase
RUN npm i
RUN npm run build:docker
RUN npm i --omit=dev

FROM node:20-alpine
RUN apk add --no-cache lrzip lrzip-extra-scripts
COPY --from=build /agent/dist /agent
COPY --from=build /agent/node_modules /agent/node_modules

RUN chown 1000 /agent -R

USER 1000

EXPOSE 8080

CMD ["node", "dist/main.js"]
