FROM node:22

WORKDIR /src

# canvas (chartjs-node-canvas) native dependencies + CJK fonts
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    pkg-config \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

ENV MOLTBOT_CONFIG_PATH=/src/moltbot.json

EXPOSE 8080

CMD ["npm", "start"]
