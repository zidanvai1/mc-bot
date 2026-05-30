require('dotenv').config();
const bedrock = require('bedrock-protocol');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

// Constants
const ADMIN_ID = 7675471513;
const MC_HOST = 'budget-cy1.gladbyte.in';
const MC_PORT = 25572;

// Bot Variables
let botName = 'ZIDAN BOT';
let mcClient = null;
let botStatus = 'Offline';

// Initialize Telegram Bot
const token = process.env.BOT_TOKEN;
const tgBot = new TelegramBot(token, { polling: true });

// Initialize Express (For Render & Web UI)
const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- BEDROCK BOT LOGIC ---
function startMcBot() {
    if (mcClient) return;
    
    botStatus = 'Starting...';
    try {
        mcClient = bedrock.createClient({
            host: MC_HOST,
            port: MC_PORT,
            username: botName,
            offline: true // Jodi server a Xbox Live auth on thake tahole eta 'false' korte hobe
        });

        mcClient.on('join', () => {
            botStatus = 'Online';
            tgBot.sendMessage(ADMIN_ID, `✅ Bot successfully joined the server as ${botName}`);
        });

        mcClient.on('text', (packet) => {
            // Forward MC Chat to Telegram
            if (packet.type === 'chat' || packet.type === 'translation') {
                const message = packet.message;
                const sender = packet.source_name || 'Server';
                if (sender !== botName) { // Nijer msg nijei forward na korar jonno
                    tgBot.sendMessage(ADMIN_ID, `💬 [${sender}]: ${message}`);
                }
            }
        });

        mcClient.on('disconnect', (packet) => {
            botStatus = 'Offline';
            mcClient = null;
            tgBot.sendMessage(ADMIN_ID, `❌ Bot disconnected from server: ${packet.reason || 'Unknown reason'}`);
        });

        mcClient.on('error', (err) => {
            console.error('MC Client Error:', err);
        });

    } catch (error) {
        botStatus = 'Offline';
        tgBot.sendMessage(ADMIN_ID, `⚠️ Error starting bot: ${error.message}`);
    }
}

function stopMcBot() {
    if (mcClient) {
        mcClient.disconnect();
        mcClient = null;
        botStatus = 'Offline';
        tgBot.sendMessage(ADMIN_ID, `🛑 Bot stopped manually.`);
    }
}

// --- TELEGRAM COMMANDS ---
tgBot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (chatId !== ADMIN_ID) return; // Only Admin can control

    const text = msg.text.trim();

    if (text === '/start_bot') {
        startMcBot();
    } else if (text === '/stop_bot') {
        stopMcBot();
    } else if (text === '/restart_bot') {
        stopMcBot();
        setTimeout(() => startMcBot(), 2000); // 2 second por abar start hobe
    } else if (text.startsWith('/cmd ')) {
        // Run OP Command
        const cmd = text.replace('/cmd ', '');
        if (mcClient) {
            mcClient.write('command_request', {
                command: cmd,
                origin: { type: 'player', uuid: mcClient.profile.uuid, request_id: '' },
                internal: false,
                version: 52
            });
            tgBot.sendMessage(chatId, `⚙️ Command sent: ${cmd}`);
        } else {
            tgBot.sendMessage(chatId, `⚠️ Bot offline! Command send kora zay nai.`);
        }
    } else if (!text.startsWith('/')) {
        // Normal text send as chat
        if (mcClient) {
            mcClient.write('text', {
                type: 'chat',
                needs_translation: false,
                source_name: botName,
                xuid: '',
                platform_chat_id: '',
                message: text
            });
            tgBot.sendMessage(chatId, `✉️ Message sent to server!`);
        } else {
            tgBot.sendMessage(chatId, `⚠️ Bot offline. Message chat a pathano zay nai.`);
        }
    }
});

// Setup Initial Bot Commands in Telegram Menu
tgBot.setMyCommands([
    { command: '/start_bot', description: 'Join MC Server' },
    { command: '/stop_bot', description: 'Leave MC Server' },
    { command: '/restart_bot', description: 'Restart Bot' },
    { command: '/cmd', description: 'Run server command (Eg: /cmd time set day)' }
]);

// --- WEB SERVER API ---
app.get('/api/status', (req, res) => {
    res.json({ status: botStatus, name: botName });
});

app.post('/api/action', (req, res) => {
    const { action, name } = req.body;
    
    if (name) botName = name; // Update bot name

    if (action === 'start') {
        startMcBot();
    } else if (action === 'stop') {
        stopMcBot();
    } else if (action === 'restart') {
        stopMcBot();
        setTimeout(() => startMcBot(), 2000);
    }
    
    res.json({ success: true, status: botStatus, name: botName });
});

// Start Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // Optional: Auto-start bot when Render wakes up
    // startMcBot(); 
});
