const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const HOST = 'fluera.aternos.me';
const PORT = 64885;
const BOT_TOKEN = process.env.BOT_TOKEN;
const TG_CHAT_ID = '7675471513';

// ── State ────────────────────────────────
let logs = [];
let botEnabled = true;
let activeClient = null;
let botSessionTimer = null;

// ── Logger ───────────────────────────────
function addLog(msg) {
  const time = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
  const logMessage = `[${time}] ${msg}`;
  console.log(logMessage);
  logs.unshift(logMessage);
  if (logs.length > 100) logs.pop();
}

// ── Telegram Send ────────────────────────
function sendToTelegram(text) {
  const body = JSON.stringify({ chat_id: TG_CHAT_ID, text });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  const req = https.request(options, () => {});
  req.on('error', () => {});
  req.write(body);
  req.end();
}

// ── Telegram Polling (TG → MC) ───────────
let lastUpdateId = 0;

function pollTelegram() {
  const path = `/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
  https.get(`https://api.telegram.org${path}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.ok && json.result.length > 0) {
          for (const update of json.result) {
            lastUpdateId = update.update_id;
            const msg = update.message;
            if (!msg || !msg.text) continue;

            // শুধু তোমার TG ID থেকে আসা message MC তে পাঠাবে
            if (String(msg.from.id) !== TG_CHAT_ID) continue;

            const text = msg.text;
            addLog(`📩 TG → MC: ${text}`);

            if (activeClient) {
              try {
                // OP থাকলে /cmd হিসেবে, না থাকলে সাধারণ chat
                if (text.startsWith('/')) {
                  activeClient.queue('command_request', {
                    command: text,
                    origin: { type: 0, uuid: '', request_id: '' },
                    internal: false,
                    version: 52
                  });
                } else {
                  activeClient.queue('text', {
                    type: 'chat',
                    needs_translation: false,
                    source_name: activeClient.username,
                    message: text,
                    parameters: [],
                    xuid: '',
                    platform_chat_id: ''
                  });
                }
              } catch (e) {
                addLog(`⚠️ MC send error: ${e.message}`);
              }
            } else {
              sendToTelegram('⚠️ Bot is currently disconnected.');
            }
          }
        }
      } catch (e) {}
      setTimeout(pollTelegram, 1000);
    });
  }).on('error', () => setTimeout(pollTelegram, 5000));
}

// ── Web Dashboard ────────────────────────
http.createServer((req, res) => {
  // Toggle endpoint
  if (req.url === '/toggle' && req.method === 'POST') {
    botEnabled = !botEnabled;
    if (botEnabled) {
      addLog('▶️ Bot enabled from web panel.');
      connectBot();
    } else {
      addLog('⏹️ Bot disabled from web panel.');
      if (activeClient) {
        try { activeClient.disconnect(); } catch (e) {}
        activeClient = null;
      }
    }
    res.writeHead(302, { Location: '/' });
    res.end();
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  const statusColor = botEnabled ? '#22c55e' : '#ef4444';
  const statusText = botEnabled ? '🟢 Running' : '🔴 Stopped';
  const btnText = botEnabled ? 'Stop Bot' : 'Start Bot';
  const btnColor = botEnabled ? '#ef4444' : '#22c55e';

  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Zidan Bot - Dashboard</title>
  <meta http-equiv="refresh" content="5">
  <style>
    body { background:#0f172a; color:#22d3ee; font-family:monospace; padding:20px; }
    h2 { color:#f8fafc; text-align:center; }
    .status { text-align:center; font-size:1.3em; margin-bottom:10px; }
    .toggle-btn {
      display:block; margin:0 auto 20px; padding:10px 30px;
      background:${btnColor}; color:#fff; border:none;
      border-radius:8px; font-size:1em; cursor:pointer; font-family:monospace;
    }
    .log-container {
      background:#020617; padding:20px; border:1px solid #334155;
      border-radius:8px; height:70vh; overflow-y:auto; line-height:1.7;
    }
    .time { color:#94a3b8; }
  </style>
</head>
<body>
  <h2>🤖 Zidan Bot - Advanced Status</h2>
  <div class="status" style="color:${statusColor}">${statusText}</div>
  <form method="POST" action="/toggle">
    <button class="toggle-btn" type="submit">${btnText}</button>
  </form>
  <div class="log-container">
    ${logs.map(l => l.replace(/\[(.*?)\]/, '<span class="time">[$1]</span>')).join('<br>')}
  </div>
</body>
</html>`);
}).listen(process.env.PORT || 3000, () => addLog('🌐 Web Server Started!'));

// ── Movement Helper ──────────────────────
function startMovement(client) {
  let tick = 0;
  const directions = ['forward', 'back', 'left', 'right'];
  let currentDir = 'forward';
  let moveTimer = 0;

  const moveInterval = setInterval(() => {
    if (!activeClient) return clearInterval(moveInterval);
    tick++;

    // দিক বদলানো (প্রতি ৮ সেকেন্ডে)
    if (tick % 8 === 0) {
      currentDir = directions[Math.floor(Math.random() * directions.length)];
    }

    // মাঝে মাঝে জাম্প (প্রতি ~২০ সেকেন্ডে একবার)
    const shouldJump = tick % 20 === 0;

    try {
      client.queue('player_action', {
        entity_runtime_id: BigInt(1),
        action: shouldJump ? 2 : // Jump
          currentDir === 'forward' ? 0 :
          currentDir === 'back' ? 1 :
          currentDir === 'left' ? 11 : 12,
        block_position: { x: 0, y: 0, z: 0 },
        result_position: { x: 0, y: 0, z: 0 },
        face: 0
      });
    } catch (e) {}

    // থামা (প্রতি ৫ সেকেন্ডে ১ সেকেন্ড)
    if (tick % 5 === 0) {
      try {
        client.queue('player_action', {
          entity_runtime_id: BigInt(1),
          action: 8, // Stop move
          block_position: { x: 0, y: 0, z: 0 },
          result_position: { x: 0, y: 0, z: 0 },
          face: 0
        });
      } catch (e) {}
    }
  }, 1000);

  return moveInterval;
}

// ── Bot Connection (Join logic unchanged) ─
function connectBot() {
  if (!botEnabled) return;

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

  activeClient = client;

  client.on('connect', () => addLog('🔗 Initiating RakNet Connection...'));

  client.on('spawn', () => {
    addLog('✅ Bot successfully joined the game!');
    sendToTelegram(`✅ ${botName} joined the server!`);

    // Anti-AFK
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', {
          request_time: BigInt(Date.now()),
          response_time: BigInt(Date.now())
        });
      } catch (e) {}
    }, 15000);

    // Movement
    const moveInterval = startMovement(client);

    // 30 min session
    botSessionTimer = setTimeout(() => {
      addLog('⏳ 30 mins complete. Cycling bot...');
      clearInterval(afkInterval);
      clearInterval(moveInterval);
      client.disconnect();
    }, 30 * 60 * 1000);

    client._afkInterval = afkInterval;
    client._moveInterval = moveInterval;
  });

  // ── MC Chat → Telegram ──────────────────
  client.on('text', (packet) => {
    if (packet.type === 'chat' || packet.type === 'announcement') {
      const sender = packet.source_name || 'Server';
      const message = packet.message || '';
      if (!message) return;
      addLog(`💬 MC Chat: <${sender}> ${message}`);
      sendToTelegram(`💬 <${sender}> ${message}`);
    }
  });

  function cleanup() {
    clearTimeout(botSessionTimer);
    if (client._afkInterval) clearInterval(client._afkInterval);
    if (client._moveInterval) clearInterval(client._moveInterval);
    activeClient = null;
  }

  client.on('disconnect', (packet) => {
    addLog(`❌ Server Disconnected: ${packet.message || 'Unknown'}`);
    sendToTelegram(`❌ Bot disconnected: ${packet.message || 'Unknown'}`);
    cleanup();
    if (botEnabled) setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    addLog(`⚠️ Connection Error: ${err.message}`);
    try { client.close(); } catch (e) {}
    cleanup();
    if (botEnabled) setTimeout(connectBot, 20000);
  });
}

// ── Start ────────────────────────────────
pollTelegram();
connectBot();
