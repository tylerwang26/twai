import { execSync } from 'child_process';

/**
 * Sends a message and an image to LINE.
 * @param {string} to - LINE User ID
 * @param {string} message - Text message
 * @param {string} imageUrl - Public image URL
 */
export function sendLineNotification(to, message, imageUrl) {
    console.log(`Sending LINE notification to ${to}...`);
    
    // Using moltbot message send
    // Note: The message tool handles images if passed correctly, 
    // but here we just append the URL for now or use the media parameter if supported.
    // Actually, moltbot message send --media <url> works.
    
    const cmd = `moltbot message send --target "${to}" --message "${message}" --media "${imageUrl}"`;
    try {
        execSync(cmd);
        console.log("LINE notification sent successfully.");
    } catch (err) {
        console.error("Failed to send LINE notification:", err.message);
    }
}

const to = process.argv[2];
const msg = process.argv[3];
const url = process.argv[4];

if (to && msg && url) {
    sendLineNotification(to, msg, url);
}
