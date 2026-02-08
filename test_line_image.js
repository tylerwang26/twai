import { messagingApi } from "@line/bot-sdk";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const to = "U03d92f2cc0d998fcf4c81e69735e12ee";

if (!token) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN");
    process.exit(1);
}

const client = new messagingApi.MessagingApiClient({
    channelAccessToken: token,
});

const imageMessage = {
    type: "image",
    originalContentUrl: "https://raw.githubusercontent.com/moltbot/moltbot/main/docs/whatsapp-clawd.jpg",
    previewImageUrl: "https://raw.githubusercontent.com/moltbot/moltbot/main/docs/whatsapp-clawd.jpg",
};

client.pushMessage({
    to,
    messages: [imageMessage],
}).then(res => {
    console.log("Success:", res);
}).catch(err => {
    console.error("Error:", err.body || err);
});
