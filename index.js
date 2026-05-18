require('dotenv').config();
const http = require('http');
const url = require('url');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

const HOST = 'fluera.aternos.me';
const PORT = 64885;

// ── Telegram Bot Setup ───────────────────
const TG_TOKEN = process.env.BOT_TOKEN;
const TG_ID = '7675471513';
let tgBot;

if (TG_TOKEN) {
    tgBot = new TelegramBot(TG_TOKEN, { polling: true });
    tgBot.on('message', (msg) => {
        if (msg.chat.id.toString() !== TG_ID) return;
        if (!msg.text) return;
        
        // টেলিগ্রাম থেকে মেসেজ পেলে যেকোনো একটি অ্যাকটিভ মাইনক্রাফট বট দিয়ে সেন্ড করবে
        const activeBotIds = Object.keys(bots).filter(id => bots[id].client);
        if (activeBotIds.length > 0) {
            const botId = activeBotIds[0];
            const client = bots[botId].client;
            try {
                client.queue('text', {
                    type: 'chat',
                    needs_translation: false,
                    source_name: client.username,
                    xuid: '',
                    platform_chat_id: '',
                    message: msg.text
                });
                addLog(`💬 TG -> MC (${client.username}): ${msg.text}`);
            } catch (e) {
                addLog(`❌ Failed to send TG message to MC: ${e.message}`);
            }
        } else {
            tgBot.sendMessage(TG_ID, '⚠️ No active Minecraft bots to send the message.');
        }
    });
} else {
    console.log("⚠️ BOT_TOKEN not found in .env file!");
}

// ── System State ─────────────────────────
let logs = [];
const bots = {}; // Store bot instances and data

function addLog(msg) {
  const time = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
  const logMessage = `[${time}] ${msg}`;
  console.log(logMessage);
  logs.unshift(logMessage); 
  if (logs.length > 100) logs.pop();
}

// ── Web Server & Dashboard ───────────────
http.createServer((req, res) => {
  const reqUrl = url.parse(req.url, true);

  // API: Get Status
  if (reqUrl.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const statusData = Object.keys(bots).map(id => ({
        id: id,
        name: bots[id].name,
        status: bots[id].status,
        position: bots[id].position,
        inventory: bots[id].inventory,
        task: bots[id].task
    }));
    return res.end(JSON.stringify({ logs, bots: statusData }));
  }

  // API: Start Bot
  if (reqUrl.pathname === '/api/start') {
    const botName = reqUrl.query.name || `Zidan_${Math.floor(Math.random() * 9000)}`;
    if (!bots[botName]) connectBot(botName);
    res.writeHead(200);
    return res.end('OK');
  }

  // API: Stop Bot
  if (reqUrl.pathname === '/api/stop') {
    const botId = reqUrl.query.id;
    if (bots[botId] && bots[botId].client) {
        bots[botId].client.disconnect();
        bots[botId].status = 'Disconnected by User';
    }
    res.writeHead(200);
    return res.end('OK');
  }

  // API: Set Task
  if (reqUrl.pathname === '/api/task') {
    const botId = reqUrl.query.id;
    const task = reqUrl.query.task;
    if (bots[botId]) {
        bots[botId].task = task;
        addLog(`🛠️ Task for ${botId} set to: ${task}`);
        // এখানে টাস্ক এর লজিক কল হবে (যেমন block ভাঙা)
    }
    res.writeHead(200);
    return res.end('OK');
  }

  // Frontend HTML (No auto-refresh meta tag, using AJAX instead)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Zidan Bot Control Panel</title>
      <style>
        body { background-color: #0f172a; color: #22d3ee; font-family: monospace; padding: 20px; }
        h2, h3 { color: #f8fafc; text-align: center; }
        .grid { display: flex; gap: 20px; }
        .panel { background-color: #020617; padding: 20px; border: 1px solid #334155; border-radius: 8px; flex: 1; height: 75vh; overflow-y: auto; }
        .bot-card { border: 1px solid #475569; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
        .bot-card h4 { margin: 0 0 10px 0; color: #fbbf24; }
        input, button, select { background: #1e293b; border: 1px solid #475569; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #334155; }
        .time { color: #94a3b8; }
      </style>
    </head>
    <body>
      <h2>🤖 Zidan Advanced Bot Controller</h2>
      <div style="text-align: center; margin-bottom: 20px;">
        <input type="text" id="newBotName" placeholder="Bot Name (Optional)">
        <button onclick="startBot()">➕ Create New Bot</button>
      </div>
      <div class="grid">
        <div class="panel" id="botList"><h3>Active Bots</h3>Loading...</div>
        <div class="panel" id="logPanel"><h3>Live Logs</h3>Loading...</div>
      </div>

      <script>
        function startBot() {
            const name = document.getElementById('newBotName').value;
            fetch('/api/start?name=' + encodeURIComponent(name)).then(updateDashboard);
        }
        function stopBot(id) { fetch('/api/stop?id=' + encodeURIComponent(id)).then(updateDashboard); }
        function setTask(id, task) { fetch('/api/task?id=' + encodeURIComponent(id) + '&task=' + encodeURIComponent(task)).then(updateDashboard); }

        function updateDashboard() {
            fetch('/api/status').then(res => res.json()).then(data => {
                // Update Logs
                document.getElementById('logPanel').innerHTML = '<h3>Live Logs</h3>' + 
                    data.logs.map(log => log.replace(/\\[(.*?)\\]/, '<span class="time">[$1]</span>')).join('<br>');
                
                // Update Bots
                let botsHtml = '<h3>Active Bots (' + data.bots.length + ')</h3>';
                data.bots.forEach(bot => {
                    botsHtml += \`
                        <div class="bot-card">
                            <h4>\${bot.name} [\${bot.status}]</h4>
                            <p><b>Pos:</b> \${bot.position}</p>
                            <p><b>Inv Items:</b> \${bot.inventory} items</p>
                            <p><b>Current Task:</b> \${bot.task}</p>
                            <select onchange="setTask('\${bot.id}', this.value)">
                                <option value="idle" \${bot.task==='idle'?'selected':''}>Idle / No Task</option>
                                <option value="mine_wood" \${bot.task==='mine_wood'?'selected':''}>Mine Wood</option>
                                <option value="mine_dirt" \${bot.task==='mine_dirt'?'selected':''}>Mine Dirt</option>
                            </select>
                            <button onclick="stopBot('\${bot.id}')" style="background:#7f1d1d;">Stop Bot</button>
                        </div>
                    \`;
                });
                document.getElementById('botList').innerHTML = botsHtml;
            });
        }
        setInterval(updateDashboard, 2000); // প্রতি ২ সেকেন্ডে আপডেট হবে
        updateDashboard();
      </script>
    </body>
    </html>
  `;
  res.end(html);
}).listen(process.env.PORT || 3000, () => {
  addLog('🌐 Web Server Started at http://localhost:3000');
});

// ── Advanced Bot Connection ──────────────
function connectBot(botName) {
  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const botId = botName;
  const fakeDeviceId = crypto.randomUUID(); 

  // Initialize bot state
  bots[botId] = {
      name: botName,
      status: 'Connecting...',
      position: 'Unknown',
      inventory: 0,
      task: 'idle',
      client: null,
      afkInterval: null
  };

  addLog(`🔌 Connecting as ${botName}...`);
  
  let client;
  try {
    // আপনার আগের জয়েন লজিক সেম টু সেম রাখা হয়েছে
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
    bots[botId].client = client;
  } catch (err) {
    addLog(`❌ Client Error (${botName}): ${err.message}`);
    bots[botId].status = 'Error';
    return;
  }

  client.on('connect', () => {
      bots[botId].status = 'Authenticating';
      addLog(`🔗 ${botName} Initiating RakNet...`);
  });
  
  client.on('spawn', () => {
    bots[botId].status = 'Online';
    addLog(`✅ ${botName} successfully joined!`);
    
    // Anti-AFK
    bots[botId].afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: BigInt(Date.now()) });
      } catch (e) {}
    }, 15000);
  });

  // ── Position & Inventory Trackers ──
  client.on('move_player', (packet) => {
      if (packet.runtime_id === client.entityId) {
          const pos = packet.position;
          bots[botId].position = `X: ${Math.floor(pos.x)}, Y: ${Math.floor(pos.y)}, Z: ${Math.floor(pos.z)}`;
      }
  });

  client.on('inventory_content', (packet) => {
      // Basic count of non-empty slots
      const itemsCount = packet.input.filter(item => item.network_id !== 0).length;
      bots[botId].inventory = itemsCount;
  });

  // ── Chat & Telegram Bridge ──
  client.on('text', (packet) => {
      if (packet.type === 'chat' || packet.type === 'announcement' || packet.type === 'translation') {
          const msg = `[MC] ${packet.source_name || 'Server'}: ${packet.message}`;
          addLog(msg);
          if (tgBot) {
              tgBot.sendMessage(TG_ID, msg).catch(err => console.log('TG Send Error', err));
          }
      }
  });

  // ── Disconnect Handlers (No 30 min auto-disconnect) ──
  client.on('disconnect', (packet) => {
    addLog(`❌ ${botName} Disconnected: ${packet.message || 'Unknown'}`);
    if(bots[botId].afkInterval) clearInterval(bots[botId].afkInterval);
    bots[botId].status = 'Disconnected';
    bots[botId].client = null;
  });

  client.on('error', (err) => {
    addLog(`⚠️ ${botName} Error: ${err.message}`);
    try { client.close(); } catch(e) {}
    if(bots[botId].afkInterval) clearInterval(bots[botId].afkInterval);
    bots[botId].status = 'Error';
    bots[botId].client = null;
  });
}

// চাইলে ডিফল্ট একটা বট প্রথমে রান করে রাখতে পারেন (Optional)
// connectBot(`Zidan_${Math.floor(Math.random() * 9000)}`);
