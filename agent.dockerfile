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
ENV NODE_ENV production

RUN apk add --no-cache lrzip lrzip-extra-scripts
COPY --from=build /agent/dist /agent/src
COPY --from=build /agent/dist/package.json /agent/package.json
COPY --from=build /agent/node_modules /agent/node_modules

RUN chown 1000 /agent -R

# create the build directory on root so it can be mounted as necessary.
RUN mkdir /build
RUN chown 1000 /build

USER 1000

EXPOSE 8080

CMD ["node", "/agent/src/main.js"]
