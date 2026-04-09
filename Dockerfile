FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev 2>/dev/null || true

COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt

COPY . .

ENV PORT=18789
ENV NODE_ENV=production
ENV WORKSPACE=/data/workspace

EXPOSE 18789

CMD ["node", "server.mjs"]
