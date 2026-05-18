require('dotenv').config();
const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

// ── Configuration ────────────────────────
const HOST = 'fluera.aternos.me';
const PORT = 64885;
const ADMIN_TG_ID = 7675471513; 

// Initialize Telegram Bot
const tgBot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Global Variables for Bot Control
let logs = [];
let botActive = true; 
let activeClient = null;
let myEntityId = null;

function addLog(msg) {
  const time = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
  const logMessage = `[${time}] ${msg}`;
  console.log(logMessage);
  logs.unshift(logMessage); 
  if (logs.length > 100) logs.pop();
}

// ── Web Server Dashboard ─────────────────
http.createServer((req, res) => {
  // Handle API Requests for ON/OFF buttons
  if (req.url === '/api/start') {
    if (!botActive) {
      botActive = true;
      addLog('▶️ Bot Started from Web Dashboard!');
      connectBot();
    }
    res.writeHead(200);
    return res.end('OK');
  }
  if (req.url === '/api/stop') {
    botActive = false;
    addLog('⏸️ Bot Stopped from Web Dashboard!');
    if (activeClient) activeClient.disconnect();
    res.writeHead(200);
    return res.end('OK');
  }

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
        h2 { color: #f8fafc; text-align: center; margin-bottom: 5px; }
        .controls { text-align: center; margin-bottom: 20px; }
        button { padding: 10px 20px; font-size: 16px; margin: 5px; cursor: pointer; border: none; border-radius: 5px; font-weight: bold; }
        .btn-start { background-color: #22c55e; color: white; }
        .btn-stop { background-color: #ef4444; color: white; }
        .status { color: ${botActive ? '#22c55e' : '#ef4444'}; font-size: 18px; text-align: center; display: block; margin-bottom: 10px; }
        .log-container { background-color: #020617; padding: 20px; border: 1px solid #334155; border-radius: 8px; height: 70vh; overflow-y: auto; line-height: 1.5; }
        .time { color: #94a3b8; }
      </style>
    </head>
    <body>
      <h2>🤖 Zidan Bot (Advanced Evasion)</h2>
      <span class="status">Status: ${botActive ? 'ONLINE / CONNECTING' : 'OFFLINE'}</span>
      
      <div class="controls">
        <button class="btn-start" onclick="fetch('/api/start')">▶ START BOT</button>
        <button class="btn-stop" onclick="fetch('/api/stop')">⏸ STOP BOT</button>
      </div>

      <div class="log-container">
        ${logs.map(log => log.replace(/\[(.*?)\]/, '<span class="time">[$1]</span>')).join('<br>')}
      </div>
    </body>
    </html>
  `;
  res.end(html);
}).listen(process.env.PORT || 3000, () => {
  addLog('🌐 Web Server & Dashboard Started on port 3000!');
  tgBot.sendMessage(ADMIN_TG_ID, '🌐 System Online! Web server started.').catch(()=>{});
});

// ── Telegram to Minecraft Chat Relay ─────
tgBot.on('message', (msg) => {
  if (msg.chat.id === ADMIN_TG_ID && msg.text) {
    if (activeClient) {
      activeClient.queue('text', {
        type: 'chat',
        needs_translation: false,
        source_name: activeClient.username,
        xuid: '',
        platform_chat_id: '',
        message: msg.text
      });
      addLog(`[TG ➡️ MC] Sent: ${msg.text}`);
    } else {
      tgBot.sendMessage(ADMIN_TG_ID, '⚠️ Bot is currently offline in Minecraft!').catch(()=>{});
    }
  }
});

// ── Advanced Bot Connection ──────────────
let botSessionTimer;

function connectBot() {
  if (!botActive) return; // Prevent connecting if stopped from web
  
  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const randomNum = Math.floor(Math.random() * 9000) + 1000; 
  const botName = `Zidan_Bot_${randomNum}`;
  
  // Fake Android Device UUID generate kora hocche
  const fakeDeviceId = crypto.randomUUID(); 

  addLog(`🔌 Connecting as ${botName}...`);
  addLog(`📱 Spoofing Device ID: ${fakeDeviceId}`);

  let client;
  try {
    // ⚠️ JOIN LOGIC 100% UNTOUCHED
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
    activeClient = client;
  } catch (err) {
    addLog(`❌ Client Error: ${err.message}`);
    if (botActive) return setTimeout(connectBot, 20000);
    return;
  }

  client.on('connect', () => addLog('🔗 Initiating RakNet Connection...'));
  
  // Entity ID capture for movement
  client.on('start_game', (packet) => {
    myEntityId = packet.runtime_entity_id;
  });

  // Minecraft to Telegram Chat Relay
  client.on('text', (packet) => {
    if (packet.type === 'chat' || packet.type === 'translation') {
      const sender = packet.source_name || 'Server';
      const msg = packet.message;
      addLog(`[MC 💬] ${sender}: ${msg}`);
      tgBot.sendMessage(ADMIN_TG_ID, `💬 [${sender}]: ${msg}`).catch(()=>{});
    }
  });

  client.on('spawn', () => {
    addLog('✅ Bot successfully joined the game!');
    tgBot.sendMessage(ADMIN_TG_ID, `✅ Bot [${botName}] joined the server!`).catch(()=>{});
    
    // Anti-AFK Tick Sync (Keep-alive packet)
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', { 
            request_time: BigInt(Date.now()), 
            response_time: BigInt(Date.now()) 
        });
      } catch (e) {}
    }, 15000);

    // Movement & Jump Logic (Anti-AFK extra)
    const moveInterval = setInterval(() => {
      if (myEntityId && botActive) {
        try {
          // Swing arm animation
          client.queue('animate', {
            action_id: 1, // 1 = swing arm
            runtime_entity_id: myEntityId
          });
          // Jump action
          client.queue('player_action', {
            runtime_entity_id: myEntityId,
            action: 'jump',
            position: { x: 0, y: 0, z: 0 },
            result_position: { x: 0, y: 0, z: 0 },
            face: 0
          });
        } catch (e) {}
      }
    }, 8000); // 8 second por por move/jump korbe

    // 30 minute er timer
    botSessionTimer = setTimeout(() => {
      addLog('⏳ 30 mins session complete. Disconnecting to cycle bot...');
      clearInterval(afkInterval);
      clearInterval(moveInterval);
      client.disconnect();
    }, 30 * 60 * 1000);
    
    client.afkInterval = afkInterval;
    client.moveInterval = moveInterval;
  });

  client.on('disconnect', (packet) => {
    addLog(`❌ Server Disconnected: ${packet.message || 'Unknown'}`);
    tgBot.sendMessage(ADMIN_TG_ID, `❌ Disconnected: ${packet.message || 'Unknown'}`).catch(()=>{});
    
    clearTimeout(botSessionTimer);
    if(client.afkInterval) clearInterval(client.afkInterval);
    if(client.moveInterval) clearInterval(client.moveInterval);
    
    activeClient = null;
    if (botActive) setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    addLog(`⚠️ Connection Error: ${err.message}`);
    try { client.close(); } catch(e) {}
    
    clearTimeout(botSessionTimer);
    if(client.afkInterval) clearInterval(client.afkInterval);
    if(client.moveInterval) clearInterval(client.moveInterval);
    
    activeClient = null;
    if (botActive) setTimeout(connectBot, 20000);
  });
}

connectBot();
