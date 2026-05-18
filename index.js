const bedrock = require('bedrock-protocol');
const express = require('express');

// Render এর জন্য ওয়েব সার্ভার
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Minecraft Bedrock Bot is Active!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// বটের কোড
function startBot() {
    console.log('সার্ভারে জয়েন করার চেষ্টা করা হচ্ছে...');
    
    const client = bedrock.createClient({
        host: 'fluera.aternos.me',   
        port: 64885,                 
        username: 'AternosBot',      
        version: '1.21.0',           
        offline: true                
    });

    client.on('join', () => {
        console.log(`[Success] ${client.options.username} সার্ভারে জয়েন করেছে!`);
    });

    client.on('disconnect', (packet) => {
        console.log('[Disconnected] কারণ:', packet.reason);
        setTimeout(startBot, 5000);
    });

    client.on('error', (err) => {
        console.error('[Error]', err.message);
    });
}

startBot();