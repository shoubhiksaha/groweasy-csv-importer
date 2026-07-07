FROM node:18-alpine

WORKDIR /app

# Copy server package files
COPY package*.json ./

RUN npm install

# Copy source
COPY . .

# Build TS
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
