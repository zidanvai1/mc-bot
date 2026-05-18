const express = require('express');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Minecraft Server Config ──────────────
const HOST = 'fluera.aternos.me';
const MC_PORT = 64885;

// Telegram Config
const TG_TOKEN = '8870119757:AAGNgY0YRZgYTyYMo_iQBoavioSGJB-EJCo';
const TG_CHAT_ID = '7675471513';
const tgBot = new TelegramBot(TG_TOKEN, { polling: true });

// ── Global States ────────────────────────
let bots = {};
let logs = [];

function addLog(msg) {
    const time = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
    const logMessage = `[${time}] ${msg}`;
    console.log(logMessage);
    logs.unshift(logMessage);
    if (logs.length > 50) logs.pop(); // Max 50 logs for memory save
}

// ── Telegram Bridge ──────────────────────
tgBot.on('message', (msg) => {
    if (msg.chat.id.toString() === TG_CHAT_ID && msg.text) {
        const onlineBot = Object.keys(bots).find(name => bots[name].status === 'Online');
        if (onlineBot && bots[onlineBot].client) {
            try {
                bots[onlineBot].client.queue('text', {
                    type: 'chat', needs_translation: false, source_name: onlineBot,
                    xuid: '', platform_chat_id: '', message: msg.text
                });
                addLog(`📨 [TG -> MC] ${msg.text}`);
            } catch (err) {
                addLog(`❌ Telegram message send failed: ${err.message}`);
            }
        } else {
            tgBot.sendMessage(TG_CHAT_ID, "⚠️ Kono bot ekhon Minecraft-e online nai!");
        }
    }
});

// ── Core Bot Logic ───────────────────────
function spawnBot(botName) {
    if (bots[botName] && (bots[botName].status === 'Online' || bots[botName].status === 'Connecting...')) {
        addLog(`⚠️ ${botName} অলরেডি কানেক্টেড বা কানেক্ট হচ্ছে!`);
        return;
    }

    addLog(`🔌 Connecting Bot: ${botName}...`);
    
    bots[botName] = {
        name: botName,
        status: 'Connecting...',
        position: 'X: 0, Y: 0, Z: 0',
        inventory: 0,
        task: 'Idle',
        client: null
    };

    try {
        const client = bedrock.createClient({
            host: HOST,
            port: MC_PORT,
            username: botName,
            offline: true,
            version: '1.21.0',
            skipPing: true,        // Direct connection bypass
            deviceOS: 1,           // Spoof as Android
            deviceId: crypto.randomUUID(),
            connectTimeout: 15000  // 15 seconds timeout
        });

        bots[botName].client = client;

        client.on('connect', () => {
            bots[botName].status = 'Bridging...';
            addLog(`🔗 ${botName}: Server network bridge established.`);
        });

        client.on('spawn', () => {
            bots[botName].status = 'Online';
            addLog(`✅ SUCCESS: ${botName} spawned into the game!`);
            tgBot.sendMessage(TG_CHAT_ID, `🤖 Bot **${botName}** successfully joined Aternos!`);
            
            // Keep Alive AFK Packet
            client.afkInterval = setInterval(() => {
                try { client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: BigInt(Date.now()) }); } catch (e) {}
            }, 10000);
        });

        client.on('move_player', (packet) => {
            if (packet.runtime_id === client.entityId) {
                bots[botName].position = `X: ${Math.floor(packet.position.x)}, Y: ${Math.floor(packet.position.y)}, Z: ${Math.floor(packet.position.z)}`;
            }
        });

        client.on('text', (packet) => {
            if ((packet.type === 'chat' || packet.type === 'translation') && packet.source_name !== botName) {
                tgBot.sendMessage(TG_CHAT_ID, `💬 [MC Chat] ${packet.source_name}: ${packet.message}`);
            }
        });

        client.on('disconnect', (packet) => {
            const reason = packet.message || "Kicked by server/Timeout";
            bots[botName].status = 'Disconnected';
            addLog(`❌ KICKED: ${botName} disconnected. Reason: ${reason}`);
            tgBot.sendMessage(TG_CHAT_ID, `❌ Bot **${botName}** left server. Reason: ${reason}`);
            cleanupBot(botName);
        });

        client.on('error', (err) => {
            bots[botName].status = 'Failed';
            addLog(`⚠️ ERROR: ${botName} connection error -> ${err.message}`);
            cleanupBot(botName);
        });

    } catch (err) {
        bots[botName].status = 'Failed';
        addLog(`❌ CRITICAL: Setup failed for ${botName} -> ${err.message}`);
    }
}

function cleanupBot(botName) {
    if (bots[botName]) {
        if (bots[botName].client) {
            try { bots[botName].client.close(); } catch (e) {}
            if (bots[botName].client.afkInterval) clearInterval(bots[botName].client.afkInterval);
        }
        bots[botName].status = 'Offline';
        bots[botName].client = null;
    }
}

// ── Express API Routes ───────────────────
app.get('/api/bots', (req, res) => {
    const data = Object.keys(bots).map(name => ({
        name: bots[name].name,
        status: bots[name].status,
        position: bots[name].position,
        inventory: bots[name].inventory,
        task: bots[name].task
    }));
    res.json(data);
});

app.get('/api/logs', (req, res) => res.json(logs));

app.get('/api/create', (req, res) => {
    const name = req.query.name;
    if (name) spawnBot(name);
    res.sendStatus(200);
});

app.get('/api/stop', (req, res) => {
    const name = req.query.name;
    if (name) cleanupBot(name);
    res.sendStatus(200);
});

// ── Mobile Optimized Dashboard ───────────
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Zidan Bot Panel</title>
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #0f172a; color: #f1f5f9; margin: 0; padding: 12px; }
        h2 { text-align: center; color: #38bdf8; font-size: 1.5rem; margin-vertical: 10px; }
        .card { background: #1e293b; padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #334155; }
        .flex-row { display: flex; gap: 8px; }
        input { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 1rem; }
        button { padding: 12px 18px; border-radius: 8px; border: none; background: #0284c7; color: white; font-weight: bold; font-size: 1rem; cursor: pointer; }
        button.stop { background: #dc2626; }
        
        /* Mobile Responsive Table Cards */
        .bot-list { display: flex; flex-direction: column; gap: 10px; }
        .bot-card { background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155; }
        .bot-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-bottom: 6px;}
        .status-Online { color: #22c55e; }
        .status-Connecting { color: #eab308; }
        .status-Failed, .status-Disconnected { color: #ef4444; }
        .bot-info { font-size: 0.9rem; color: #94a3b8; margin: 4px 0; }
        
        /* Log Console Box */
        .console { background: #020617; border-radius: 8px; height: 250px; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 0.85rem; line-height: 1.4; border: 1px solid #1e293b; }
        .log-line { border-bottom: 1px solid #0f172a; padding: 3px 0; word-break: break-all; }
      </style>
    </head>
    <body>
      <h2>⚙️ Zidan Bot Controller</h2>
      
      <div class="card">
        <div class="flex-row">
          <input type="text" id="nameInput" placeholder="Bot Name (e.g. Zidan_Bot)">
          <button onclick="createBot()">Spawn</button>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0; font-size:1.1rem; color:#94a3b8;">🤖 Active Bots</h3>
        <div id="botList" class="bot-list"></div>
      </div>

      <div class="card">
        <h3 style="margin-top:0; font-size:1.1rem; color:#f43f5e;">📋 Live System Logs (Error Debugger)</h3>
        <div id="console" class="console"></div>
      </div>

      <script>
        function createBot() {
            const input = document.getElementById('nameInput');
            if(!input.value.trim()) return alert('Name likhen!');
            fetch('/api/create?name=' + encodeURIComponent(input.value.trim()));
            input.value = '';
        }
        
        function stopBot(name) {
            fetch('/api/stop?name=' + encodeURIComponent(name));
        }

        function refreshData() {
            // Fetch Bots Status
            fetch('/api/bots').then(res => res.json()).then(data => {
                const container = document.getElementById('botList');
                if(data.length === 0) {
                    container.innerHTML = '<div style="text-align:center;color:#64748b;font-size:0.9rem;">No active bots found.</div>';
                    return;
                }
                container.innerHTML = '';
                data.forEach(b => {
                    container.innerHTML += \`
                        <div class="bot-card">
                            <div class="bot-header">
                                <span>\${b.name}</span>
                                <span class="status-\${b.status.replace('...','').trim()}">\${b.status}</span>
                            </div>
                            <div class="bot-info">📍 Pos: \${b.position}</div>
                            <div class="bot-info">⚙️ Task: \${b.task}</div>
                            <div style="text-align: right; margin-top: 8px;">
                                <button class="stop" style="padding:6px 12px; font-size:0.85rem;" onclick="stopBot('\${b.name}')">Stop</button>
                            </div>
                        </div>
                    \`;
                });
            });

            // Fetch Live Logs
            fetch('/api/logs').then(res => res.json()).then(logData => {
                const consoleDiv = document.getElementById('console');
                consoleDiv.innerHTML = logData.map(l => \`<div class="log-line">\${l}</div>\`).join('');
            });
        }

        setInterval(refreshData, 2000); // UI updates every 2 seconds
        refreshData();
      </script>
    </body>
    </html>
    `);
});

// Start Web Server
app.listen(PORT, () => addLog(`🌐 Web Management Server online on port ${PORT}`));
