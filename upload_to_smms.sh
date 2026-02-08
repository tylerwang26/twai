#!/bin/bash
IMAGE_PATH="$1"
# SM.MS 不需要 API Key 也可以匿名上傳 (有限制)，或使用 Token
# 這裡先實作匿名上傳測試

if [ -z "$IMAGE_PATH" ]; then
    echo "Usage: $0 <image_path>"
    exit 1
fi

RESPONSE=$(curl -s -X POST -H "Content-Type: multipart/form-data" -F "smfile=@$IMAGE_PATH" https://sm.ms/api/v2/upload)
URL=$(echo "$RESPONSE" | grep -oP '"url":"\K[^"]+')

if [ -z "$URL" ]; then
    # 嘗試從 success:false 的回傳中找連結 (SM.MS 會提示圖片已存在並給出連結)
    URL=$(echo "$RESPONSE" | grep -oP '"images":"\K[^"]+')
fi

echo "$URL" | sed 's/\\//g'
