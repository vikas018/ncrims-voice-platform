# NCRIMS backend container — for Back4App Containers (or any Docker host).
FROM node:20-alpine

# App lives here inside the container.
WORKDIR /usr/src/app

# Install production dependencies first (better layer caching).
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the source.
COPY . .

ENV NODE_ENV=production
# The app honors process.env.PORT; Back4App maps this exposed port.
EXPOSE 5000

CMD ["node", "src/server.js"]
