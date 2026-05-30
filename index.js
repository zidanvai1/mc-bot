require('dotenv').config();
const bedrock = require('bedrock-protocol');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Constants
const ADMIN_ID = 7675471513;
const MC_HOST = 'budget-cy1.gladbyte.in';
const MC_PORT = 25572;

// Bot Variables
let botName = 'ZIDAN BOT';
let mcClient = null;
let botStatus = 'Offline';
let awaitingCommand = false;
let panelMessageId = null; // Control panel er message ID save rakhbe

// Telegram & Express
const token = process.env.BOT_TOKEN;
const tgBot = new TelegramBot(token, { polling: true });
const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- TELEGRAM INLINE CONTROL PANEL ---
// Ei panel edit hobe, notun msg ashbe na ba dlt hobe na.
function getPanelMarkup() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🟢 Start / Join', callback_data: 'action_start' }, { text: '🔴 Stop / Leave', callback_data: 'action_stop' }],
                [{ text: '🔄 Restart', callback_data: 'action_restart' }, { text: '⚙️ Send Command', callback_data: 'action_cmd' }]
            ]
        }
    };
}

function updatePanel(chatId, text) {
    const content = `🎮 **ZIDAN BOT Control Panel**\n\n📊 Status: **${botStatus}**\n📝 Note: ${text}`;
    
    if (panelMessageId) {
        // Message edit korbe (Blink ba Delete hobe na)
        tgBot.editMessageText(content, {
            chat_id: chatId,
            message_id: panelMessageId,
            parse_mode: 'Markdown',
            ...getPanelMarkup()
        }).catch(() => {}); // Choto error ignore korbe
    } else {
        // First time panel send korbe
        tgBot.sendMessage(chatId, content, { parse_mode: 'Markdown', ...getPanelMarkup() })
            .then(msg => { panelMessageId = msg.message_id; });
    }
}

// --- BEDROCK BOT LOGIC ---
function startMcBot(chatId) {
    if (mcClient) {
        updatePanel(chatId, 'Bot is already Online!');
        return;
    }
    
    botStatus = 'Starting...';
    updatePanel(chatId, 'Connecting to server...');
    
    try {
        mcClient = bedrock.createClient({
            host: MC_HOST,
            port: MC_PORT,
            username: botName,
            offline: true
        });

        // 'join' er bodole 'spawn' use kora hoyeche, nahole server msg block kore
        mcClient.on('spawn', () => {
            botStatus = 'Online';
            updatePanel(chatId, `Successfully joined as ${botName} ✅`);
        });

        // Server theke chat ashle
        mcClient.on('text', (packet) => {
            if (packet.type === 'chat' || packet.type === 'translation') {
                const message = packet.message || packet.parameters?.[1] || '';
                const sender = packet.source_name || packet.parameters?.[0] || 'Server';
                
                if (sender !== mcClient.username && message) { 
                    tgBot.sendMessage(ADMIN_ID, `💬 [${sender}]: ${message}`);
                }
            }
        });

        mcClient.on('disconnect', (packet) => {
            botStatus = 'Offline';
            mcClient = null;
            updatePanel(chatId, `Disconnected: ${packet.reason || 'Unknown'}`);
        });

        mcClient.on('error', (err) => {
            console.error('MC Error:', err);
        });

    } catch (error) {
        botStatus = 'Offline';
        updatePanel(chatId, `Error: ${error.message}`);
    }
}

function stopMcBot(chatId) {
    if (mcClient) {
        mcClient.disconnect();
        mcClient = null;
        botStatus = 'Offline';
        updatePanel(chatId, 'Bot manually stopped 🛑');
    } else {
        updatePanel(chatId, 'Bot is already Offline.');
    }
}

// --- TELEGRAM MESSAGE HANDLER ---
tgBot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (chatId !== ADMIN_ID) return;

    const text = msg.text?.trim();
    if (!text) return;

    // Just first time control panel anar jonno jekono msg ba /start dilei hobe
    if (text === '/start' || text === '/panel') {
        panelMessageId = null; 
        updatePanel(chatId, 'Welcome to Panel! Use the buttons below.');
        return;
    }

    if (awaitingCommand) {
        // Send command to MC
        if (mcClient) {
            const cmd = text.startsWith('/') ? text.substring(1) : text;
            mcClient.write('command_request', {
                command: cmd,
                origin: { type: 'player', uuid: mcClient.profile.uuid, request_id: '' },
                internal: false,
                version: 52
            });
            awaitingCommand = false;
            updatePanel(chatId, `Command sent: /${cmd} ⚙️`);
        } else {
            awaitingCommand = false;
            updatePanel(chatId, 'Bot offline! Command failed.');
        }
    } else {
        // Send as Player Chat in MC
        if (mcClient) {
            mcClient.write('text', {
                type: 'chat',
                needs_translation: false,
                source_name: mcClient.username,
                xuid: '',
                platform_chat_id: '',
                message: text
            });
            // Apni jate bujhte paren msg geche, tai choto ekta reaction message pathalam
            tgBot.sendMessage(chatId, `✉️ You: ${text}`);
        } else {
            updatePanel(chatId, '⚠️ Bot offline! Please start the bot first to chat.');
        }
    }
});

// --- TELEGRAM BUTTON CLICK HANDLER ---
tgBot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    if (chatId !== ADMIN_ID) return;

    const action = query.data;
    awaitingCommand = false; // Reset command state on any button press

    if (action === 'action_start') {
        startMcBot(chatId);
    } else if (action === 'action_stop') {
        stopMcBot(chatId);
    } else if (action === 'action_restart') {
        stopMcBot(chatId);
        setTimeout(() => startMcBot(chatId), 2000);
    } else if (action === 'action_cmd') {
        awaitingCommand = true;
        updatePanel(chatId, 'Type your command in the chat now (e.g. time set day)...');
    }

    // Button loading animation stop korar jonno
    tgBot.answerCallbackQuery(query.id).catch(() => {});
});

// --- WEB SERVER API (Remains Unchanged) ---
app.get('/api/status', (req, res) => {
    res.json({ status: botStatus, name: botName });
});

app.post('/api/action', (req, res) => {
    const { action, name } = req.body;
    if (name) botName = name; 

    if (action === 'start') {
        startMcBot(ADMIN_ID);
    } else if (action === 'stop') {
        stopMcBot(ADMIN_ID);
    } else if (action === 'restart') {
        stopMcBot(ADMIN_ID);
        setTimeout(() => startMcBot(ADMIN_ID), 2000);
    }
    
    res.json({ success: true, status: botStatus, name: botName });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
