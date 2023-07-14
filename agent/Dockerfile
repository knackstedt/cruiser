FROM node:alpine-22.04

WORKDIR /agent

COPY dist /app/dist
COPY package.json /app/package.json
COPY ecosystem.config.js /app/ecosystem.config.js

# Install server deps
RUN npm i
RUN npm run build

CMD ["node", "agent.js"]
