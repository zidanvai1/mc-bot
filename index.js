const bedrock = require('bedrock-protocol');
const express = require('express');

// Render-এর জন্য ওয়েব সার্ভার (যাতে হোস্টিং বন্ধ না হয়)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Minecraft Bedrock Bot is Active!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// বট তৈরি করার ফাংশন
function startBot() {
    console.log('সার্ভারে জয়েন করার চেষ্টা করা হচ্ছে...');
    
    const client = bedrock.createClient({
        host: 'fluera.aternos.me',   // আপনার Aternos IP
        port: 64885,                 // আপনার Aternos Port
        username: 'AternosBot',      // বটের নাম
        version: '1.21.0',           // আপনার মাইনক্রাফট ভার্সন
        offline: true,               // Cracked সার্ভারের জন্য
        skipPing: true               // Aternos-এর Ping ব্লক বাইপাস করার জন্য
    });

    // সার্ভারে জয়েন করলে যা দেখাবে
    client.on('join', () => {
        console.log(`[Success] ${client.options.username} সার্ভারে সফলভাবে জয়েন করেছে!`);
    });

    // কেউ মেসেজ দিলে কনসোলে দেখাবে
    client.on('text', (packet) => {
        if (packet.source_name !== client.options.username) {
            console.log(`[Chat] ${packet.source_name}: ${packet.message}`);
        }
    });

    // সার্ভার থেকে কিক বা ডিসকানেক্ট হলে অটো-রিকানেক্ট (৫ সেকেন্ড পর)
    client.on('disconnect', (packet) => {
        console.log('[Disconnected] বট সার্ভার থেকে বের হয়ে গেছে। কারণ:', packet.reason);
        console.log('৫ সেকেন্ড পর আবার চেষ্টা করা হচ্ছে...');
        setTimeout(startBot, 5000);
    });

    // এরর আসলে কনসোলে দেখাবে
    client.on('error', (err) => {
        console.error('[Error]', err.message);
    });
}

// বট চালু করা
startBot();
