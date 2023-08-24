FROM node:18-alpine

WORKDIR /agent

COPY . .

# Install server deps
RUN npm i
RUN npm run build

CMD ["node", "agent.js"]
