require('dotenv').config();
const bedrock = require('bedrock-protocol');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const ADMIN_ID = 7675471513;
const MC_HOST = 'budget-cy1.gladbyte.in';
const MC_PORT = 25572;

let botName = 'ZIDAN BOT';
let mcClient = null;
let botStatus = 'Offline';
let startTime = null;
let errorLog = "No errors yet.";

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Reply Keyboard Definition
const replyKeyboard = {
    reply_markup: {
        keyboard: [
            ['🟢 Join', '🔴 Leave'],
            ['🔄 Restart', '📊 Stats'],
            ['📋 View Logs']
        ],
        resize_keyboard: true,
        persistent: true // Eta bar bar asbe na, fixed thakbe
    }
};

function sendDashboard(chatId, message = "Bot Dashboard") {
    const uptime = startTime ? Math.floor((Date.now() - startTime) / 1000 / 60) + " min" : "N/A";
    const playerList = mcClient ? (mcClient.players ? Object.keys(mcClient.players).join(', ') : "None") : "N/A";
    const playerCount = mcClient ? (mcClient.players ? Object.keys(mcClient.players).length : 0) : 0;

    const text = `🎮 *${botName} Status*\n\n` +
                 `Status: *${botStatus}*\n` +
                 `Uptime: *${uptime}*\n` +
                 `Online Players (${playerCount}): *${playerList}*\n\n` +
                 `Info: ${message}`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...replyKeyboard });
}

function startMcBot(chatId) {
    if (mcClient) return sendDashboard(chatId, "Already Online!");
    
    botStatus = 'Joining...';
    mcClient = bedrock.createClient({ host: MC_HOST, port: MC_PORT, username: botName, offline: true });

    mcClient.on('spawn', () => {
        botStatus = 'Online';
        startTime = Date.now();
        sendDashboard(chatId, "Successfully joined!");
    });

    mcClient.on('text', (packet) => {
        if (packet.type === 'chat') {
            bot.sendMessage(ADMIN_ID, `💬 [${packet.source_name}]: ${packet.message}`);
        }
    });

    mcClient.on('error', (err) => {
        errorLog = err.message;
        botStatus = 'Offline';
        bot.sendMessage(ADMIN_ID, `⚠️ ERROR: ${err.message}`);
    });
}

// Telegram Message Handler
bot.on('message', (msg) => {
    const text = msg.text;
    if (msg.chat.id !== ADMIN_ID) return;

    if (text === '🟢 Join') startMcBot(ADMIN_ID);
    else if (text === '🔴 Leave') {
        if (mcClient) mcClient.disconnect();
        mcClient = null;
        botStatus = 'Offline';
        sendDashboard(ADMIN_ID, "Bot left the server.");
    }
    else if (text === '📊 Stats') sendDashboard(ADMIN_ID, "Stats updated.");
    else if (text === '📋 View Logs') bot.sendMessage(ADMIN_ID, `📜 LOGS:\n${errorLog}`);
    else if (text === '🔄 Restart') {
        if (mcClient) mcClient.disconnect();
        setTimeout(() => startMcBot(ADMIN_ID), 1000);
    }
    else {
        // Chat forward
        if (mcClient) {
            mcClient.write('text', { type: 'chat', source_name: botName, message: text });
        }
    }
});
