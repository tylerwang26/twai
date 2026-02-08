#!/bin/bash
IMAGE_PATH="$1"
CLIENT_ID="YOUR_IMGUR_CLIENT_ID" # 這需要用戶提供或我們預設一個

if [ -z "$IMAGE_PATH" ]; then
    echo "Usage: $0 <image_path>"
    exit 1
fi

# 這裡是一個佔位符腳本，展示如何使用 curl 上傳
# curl -s -H "Authorization: Client-ID $CLIENT_ID" -F "image=@$IMAGE_PATH" https://api.imgur.com/3/image | jq -r '.data.link'
echo "https://example.com/uploaded_image.png"
