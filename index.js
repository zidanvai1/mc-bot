require('dotenv').config(); // .env ফাইল থেকে টোকেন নেওয়ার জন্য
const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto'); // Random Device ID toiri korar jonno
const TelegramBot = require('node-telegram-bot-api'); // TG Bot এর জন্য

const HOST = 'fluera.aternos.me';
const PORT = 64885;

// --- Telegram Bot Setup ---
const tgToken = process.env.BOT_TOKEN;
const tgAdminId = 7675471513;
const tgBot = new TelegramBot(tgToken, { polling: true });

// --- Global Variables for New Features ---
let botActive = true; 
let activeClient = null;
let myEntityId = null;

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
  // Web page theke ON/OFF korar logic
  if (req.url === '/start') {
    if (!botActive) { botActive = true; connectBot(); }
    res.writeHead(200); return res.end('Started');
  }
  if (req.url === '/stop') {
    botActive = false; 
    if (activeClient) activeClient.disconnect();
    res.writeHead(200); return res.end('Stopped');
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
        h2 { color: #f8fafc; text-align: center; }
        .log-container { background-color: #020617; padding: 20px; border: 1px solid #334155; border-radius: 8px; height: 75vh; overflow-y: auto; line-height: 1.5; }
        .time { color: #94a3b8; }
        .btn { padding: 8px 15px; margin: 5px; cursor: pointer; color: white; border: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>🤖 Zidan Bot (Advanced Evasion) - Status</h2>
      <div style="text-align: center; margin-bottom: 15px;">
         <span style="color: ${botActive ? 'lime' : 'red'}; font-size: 18px;">Status: ${botActive ? 'ONLINE' : 'OFFLINE'}</span><br>
         <button class="btn" style="background: green;" onclick="fetch('/start')">START BOT</button>
         <button class="btn" style="background: red;" onclick="fetch('/stop')">STOP BOT</button>
      </div>
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

// ── Advanced Bot Connection ──────────────
let botSessionTimer;

function connectBot() {
  if (!botActive) return; // web theke off korle jeno ar connect na hoy

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
    activeClient = client;
  } catch (err) {
    addLog(`❌ Client Error: ${err.message}`);
    return setTimeout(connectBot, 20000);
  }

  client.on('connect', () => addLog('🔗 Initiating RakNet Connection...'));
  
  // Entity id capture for jumping
  client.on('start_game', (packet) => { myEntityId = packet.runtime_entity_id; });

  // MC chat ke TG te pathano
  client.on('text', (packet) => {
    if (packet.type === 'chat' || packet.type === 'translation') {
      tgBot.sendMessage(tgAdminId, `💬 [${packet.source_name || 'Server'}]: ${packet.message}`).catch(()=>{});
    }
  });

  client.on('spawn', () => {
    addLog('✅ Bot successfully joined the game!');
    tgBot.sendMessage(tgAdminId, `✅ Bot [${botName}] joined!`).catch(()=>{});
    
    // Anti-AFK Tick Sync (Keep-alive packet)
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', { 
            request_time: BigInt(Date.now()), 
            response_time: BigInt(Date.now()) 
        });
      } catch (e) {}
    }, 15000);

    // Jump & Move (Anti-AFK)
    const moveInterval = setInterval(() => {
      try {
        if (myEntityId) {
          client.queue('animate', { action_id: 1, runtime_entity_id: myEntityId });
          client.queue('player_action', { runtime_entity_id: myEntityId, action: 'jump', position: { x: 0, y: 0, z: 0 }, result_position: { x: 0, y: 0, z: 0 }, face: 0 });
        }
      } catch (e) {}
    }, 8000);

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
    tgBot.sendMessage(tgAdminId, `❌ Disconnected: ${packet.message || 'Unknown'}`).catch(()=>{});
    activeClient = null;

    clearTimeout(botSessionTimer);
    if(client.afkInterval) clearInterval(client.afkInterval);
    if(client.moveInterval) clearInterval(client.moveInterval);
    setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    addLog(`⚠️ Connection Error: ${err.message}`);
    try { client.close(); } catch(e) {}
    activeClient = null;

    clearTimeout(botSessionTimer);
    if(client.afkInterval) clearInterval(client.afkInterval);
    if(client.moveInterval) clearInterval(client.moveInterval);
    setTimeout(connectBot, 20000);
  });
}

// TG theke msg asle MC te pathano
tgBot.on('message', (msg) => {
  if (msg.chat.id === tgAdminId && msg.text && activeClient) {
    try {
      activeClient.queue('text', { type: 'chat', needs_translation: false, source_name: activeClient.username, xuid: '', platform_chat_id: '', message: msg.text });
    } catch(e) {}
  }
});

connectBot();
