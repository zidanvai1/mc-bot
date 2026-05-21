const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto');
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const HOST = 'fluera.aternos.me';
const PORT = 64885;
const TG_TOKEN = process.env.BOT_TOKEN;
const TG_CHAT_ID = '7675471513';

// ── Telegram Bot Setup ───────────────────
const tgBot = new TelegramBot(TG_TOKEN, { polling: true });

// ── Web Logger System ────────────────────
let logs = [];
function addLog(msg) {
  const time = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
  const logMessage = `[${time}] ${msg}`;
  console.log(logMessage);
  logs.unshift(logMessage);
  if (logs.length > 100) logs.pop();
}

// ── Web Server Dashboard ─────────────────
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Zidan Bot - Advanced Status</title>
      <meta http-equiv="refresh" content="3">
      <style>
        body { background-color: #0f172a; color: #22d3ee; font-family: monospace; padding: 20px; }
        h2 { color: #f8fafc; text-align: center; }
        .log-container { background-color: #020617; padding: 20px; border: 1px solid #334155; border-radius: 8px; height: 75vh; overflow-y: auto; line-height: 1.5; }
        .time { color: #94a3b8; }
      </style>
    </head>
    <body>
      <h2>🤖 Zidan Bot (Advanced Evasion) - Status</h2>
      <div class="log-container">
        ${logs.map(log => log.replace(/\[(.*?)\]/, '<span class="time">[$1]</span>')).join('<br>')}
      </div>
    </body>
    </html>
  `;
  res.end(html);
}).listen(process.env.PORT || 3000, () => {
  addLog('🌐 Web Server Started!');
});

// ── Bot State ────────────────────────────
let activeClient = null;   // Current MC client
let isInGame = false;      // Bot game-এ আছে কিনা

// ── Telegram → MC Chat ───────────────────
tgBot.on('message', (msg) => {
  // শুধু নির্দিষ্ট chat ID থেকে command নেবে
  if (String(msg.chat.id) !== TG_CHAT_ID) return;

  const text = msg.text;
  if (!text) return;

  if (!isInGame || !activeClient) {
    tgBot.sendMessage(TG_CHAT_ID, '⚠️ Bot এখন game-এ নেই, message পাঠানো যাচ্ছে না।');
    return;
  }

  try {
    activeClient.queue('text', {
      type: 'chat',
      needs_translation: false,
      source_name: activeClient.username,
      xuid: '',
      platform_chat_id: '',
      message: text,
    });
    addLog(`📤 TG → MC: ${text}`);
  } catch (e) {
    addLog(`❌ TG→MC Send Error: ${e.message}`);
  }
});

// ── Advanced Bot Connection ──────────────
function connectBot() {
  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  const botName = `Zidan_Bot_${randomNum}`;
  const fakeDeviceId = crypto.randomUUID();

  addLog(`🔌 Connecting as ${botName}...`);
  addLog(`📱 Spoofing Device ID: ${fakeDeviceId}`);

  let client;
  try {
    client = bedrock.createClient({
      host: HOST,
      port: PORT,
      username: botName,
      offline: true,
      version: '1.21.0',
      skipPing: true,
      deviceOS: 1,
      deviceId: fakeDeviceId,
      connectTimeout: 30000
    });
  } catch (err) {
    addLog(`❌ Client Error: ${err.message}`);
    return setTimeout(connectBot, 20000);
  }

  client.on('connect', () => addLog('🔗 Initiating RakNet Connection...'));

  client.on('spawn', () => {
    addLog('✅ Bot successfully joined the game!');
    activeClient = client;
    isInGame = true;

    tgBot.sendMessage(TG_CHAT_ID, `✅ *${botName}* game-এ join করেছে!`, { parse_mode: 'Markdown' });

    // ── MC Chat → Telegram ───────────────
    client.on('text', (packet) => {
      if (!isInGame) return;

      const sender = packet.source_name || '';
      const message = packet.message || '';

      // Bot নিজের message skip করো
      if (sender === botName) return;
      if (!message.trim()) return;

      const formatted = sender ? `💬 *${sender}*: ${message}` : `📢 ${message}`;
      addLog(`📩 MC→TG: ${formatted}`);

      tgBot.sendMessage(TG_CHAT_ID, formatted, { parse_mode: 'Markdown' }).catch(() => {
        tgBot.sendMessage(TG_CHAT_ID, `💬 ${sender}: ${message}`);
      });
    });

    // Anti-AFK Tick Sync
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', {
          request_time: BigInt(Date.now()),
          response_time: BigInt(Date.now())
        });
      } catch (e) {}
    }, 15000);

    client.afkInterval = afkInterval;
  });

  client.on('disconnect', (packet) => {
    addLog(`❌ Server Disconnected: ${packet.message || 'Unknown'}`);
    isInGame = false;
    activeClient = null;
    if (client.afkInterval) clearInterval(client.afkInterval);
    tgBot.sendMessage(TG_CHAT_ID, `❌ Bot disconnect হয়েছে: ${packet.message || 'Unknown'}`);
    setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    addLog(`⚠️ Connection Error: ${err.message}`);
    isInGame = false;
    activeClient = null;
    try { client.close(); } catch (e) {}
    if (client.afkInterval) clearInterval(client.afkInterval);
    setTimeout(connectBot, 20000);
  });
}

connectBot();
