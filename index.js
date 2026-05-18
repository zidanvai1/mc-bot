require('dotenv').config();
const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto');
const url = require('url');
const TelegramBot = require('node-telegram-bot-api');

const HOST = 'fluera.aternos.me';
const PORT = 64885;

// ── Web Logger System ────────────────────
let logs = [];

function addLog(msg) {
  const time = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
  const logMessage = `[${time}] ${msg}`;
  console.log(logMessage);
  logs.unshift(logMessage); 
  if (logs.length > 100) logs.pop();
}

// ── Variables & Controls ─────────────────
let isBotEnabled = true; // Default Start
let sessionMinutes = 30; // Default 30 mins
let currentClient = null; // Prevent double join
let isConnecting = false;
let reconnectTimeout = null;

// ── Telegram Bot Setup ───────────────────
const tgToken = process.env.BOT_TOKEN;
const adminId = '7675471513';
let tgBot = null;

if (tgToken) {
  tgBot = new TelegramBot(tgToken, { polling: true });
  addLog('🤖 Telegram Bot Connected!');

  tgBot.on('message', (msg) => {
    // Only allow admin
    if (msg.chat.id.toString() !== adminId) return;
    if (!msg.text) return;

    if (currentClient) {
      // Send message/command to Minecraft
      currentClient.queue('text', {
        type: 'chat',
        needs_translation: false,
        source_name: currentClient.username,
        xuid: '',
        platform_chat_id: '',
        message: msg.text
      });
      addLog(`💬 TG -> MC: ${msg.text}`);
      tgBot.sendMessage(adminId, `✅ Sent to MC: ${msg.text}`);
    } else {
      tgBot.sendMessage(adminId, '❌ Bot is currently offline.');
    }
  });
} else {
  addLog('⚠️ BOT_TOKEN not found in .env file!');
}

// ── Web Server Dashboard ─────────────────
http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // API Endpoints for Controls
  if (parsedUrl.pathname === '/api/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ logs, isBotEnabled, sessionMinutes }));
  }
  if (parsedUrl.pathname === '/api/toggle') {
    isBotEnabled = !isBotEnabled;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (isBotEnabled) {
      addLog('🟢 Bot Enabled from Web Dashboard');
      connectBot(); // Start bot manually if enabled
    } else {
      addLog('🔴 Bot Disabled from Web Dashboard');
      clearTimeout(reconnectTimeout);
      if (currentClient) currentClient.disconnect();
    }
    return res.end(JSON.stringify({ success: true, status: isBotEnabled }));
  }
  if (parsedUrl.pathname === '/api/set_time') {
    const mins = parseInt(parsedUrl.query.mins);
    if (mins && mins > 0) {
      sessionMinutes = mins;
      addLog(`⏳ Session Time updated to ${sessionMinutes} minutes`);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, sessionMinutes }));
  }

  // Dashboard UI (Removed meta refresh to avoid losing input focus)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Zidan Bot - Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { background-color: #0f172a; color: #22d3ee; font-family: monospace; padding: 20px; }
        h2 { color: #f8fafc; text-align: center; }
        .controls { background-color: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        input, button { padding: 10px; border: none; border-radius: 5px; font-weight: bold; font-family: monospace; }
        input { width: 80px; text-align: center; }
        button { cursor: pointer; background-color: #3b82f6; color: white; }
        #toggleBtn { background-color: ${isBotEnabled ? '#ef4444' : '#22c55e'}; }
        .log-container { background-color: #020617; padding: 20px; border: 1px solid #334155; border-radius: 8px; height: 60vh; overflow-y: auto; line-height: 1.5; }
        .time { color: #94a3b8; }
      </style>
    </head>
    <body>
      <h2>🤖 Zidan Bot (Advanced Control)</h2>
      
      <div class="controls">
        <button id="toggleBtn" onclick="toggleBot()">
          ${isBotEnabled ? '🔴 Stop Bot' : '🟢 Start Bot'}
        </button>
        <div style="display: flex; gap: 5px; align-items: center;">
          <input type="number" id="timeInput" value="${sessionMinutes}">
          <span>Mins</span>
          <button onclick="setTime()">Set Timer</button>
        </div>
      </div>

      <div class="log-container" id="logBox">Loading logs...</div>

      <script>
        // Fetch logs automatically without reloading the page
        setInterval(async () => {
          const res = await fetch('/api/logs');
          const data = await res.json();
          const logHtml = data.logs.map(log => log.replace(/\\[(.*?)\\]/, '<span class="time">[$1]</span>')).join('<br>');
          document.getElementById('logBox').innerHTML = logHtml;
          
          const btn = document.getElementById('toggleBtn');
          if(data.isBotEnabled) {
            btn.innerText = '🔴 Stop Bot';
            btn.style.backgroundColor = '#ef4444';
          } else {
            btn.innerText = '🟢 Start Bot';
            btn.style.backgroundColor = '#22c55e';
          }
        }, 2000);

        async function toggleBot() {
          await fetch('/api/toggle');
        }

        async function setTime() {
          const mins = document.getElementById('timeInput').value;
          await fetch('/api/set_time?mins=' + mins);
          alert('Time set to ' + mins + ' minutes!');
        }
      </script>
    </body>
    </html>
  `;
  res.end(html);
}).listen(process.env.PORT || 3000, () => {
  addLog('🌐 Web Server Dashboard Started!');
});

// ── Advanced Bot Connection ──────────────
let botSessionTimer;

function connectBot() {
  // Prevent duplicate connections or connecting if disabled
  if (!isBotEnabled) return;
  if (currentClient || isConnecting) {
    return;
  }
  
  isConnecting = true;
  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const randomNum = Math.floor(Math.random() * 9000) + 1000; 
  const botName = `Zidan_Bot_${randomNum}`;
  
  // Fake Android Device UUID generate kora hocche
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
      skipPing: true,        // Ping ekebare skip korbe (Direct Join)
      deviceOS: 1,           // 1 = Android, 7 = Windows (Spoofing as mobile)
      deviceId: fakeDeviceId, 
      connectTimeout: 30000
    });
    currentClient = client; // Set as active client
  } catch (err) {
    addLog(`❌ Client Error: ${err.message}`);
    isConnecting = false;
    currentClient = null;
    if (isBotEnabled) reconnectTimeout = setTimeout(connectBot, 20000);
    return;
  }

  client.on('connect', () => {
    isConnecting = false;
    addLog('🔗 Initiating RakNet Connection...');
  });
  
  client.on('spawn', () => {
    addLog('✅ Bot successfully joined the game!');
    
    // Anti-AFK Tick Sync (Keep-alive packet)
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', { 
            request_time: BigInt(Date.now()), 
            response_time: BigInt(Date.now()) 
        });
      } catch (e) {}
    }, 15000);

    // Dynamic Timer (controlled from web)
    botSessionTimer = setTimeout(() => {
      addLog(`⏳ ${sessionMinutes} mins session complete. Disconnecting to cycle bot...`);
      clearInterval(afkInterval);
      client.disconnect();
    }, sessionMinutes * 60 * 1000);
    
    client.afkInterval = afkInterval;
  });

  // ── Minecraft Chat to Telegram Forwarder ──
  client.on('text', (packet) => {
    if (packet.type === 'chat' || packet.type === 'translation') {
      const msg = packet.message;
      const source = packet.source_name;
      
      // Avoid looping own messages
      if (source === client.username) return;

      const formatMsg = source ? `[MC] ${source}: ${msg}` : `[MC] ${msg}`;
      if (tgBot) {
        tgBot.sendMessage(adminId, formatMsg).catch(()=>{});
      }
    }
  });

  function handleDisconnect() {
    clearTimeout(botSessionTimer);
    if (client.afkInterval) clearInterval(client.afkInterval);
    if (currentClient === client) currentClient = null;
    isConnecting = false;
    
    // Only auto-reconnect if bot is still enabled
    if (isBotEnabled) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(connectBot, 20000);
    }
  }

  client.on('disconnect', (packet) => {
    addLog(`❌ Server Disconnected: ${packet.message || 'Unknown'}`);
    handleDisconnect();
  });

  client.on('error', (err) => {
    addLog(`⚠️ Connection Error: ${err.message}`);
    try { client.close(); } catch(e) {}
    handleDisconnect();
  });
}

// Start Default System
connectBot();
