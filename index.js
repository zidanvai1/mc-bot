const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

// ── Configuration ─────────────────────────
const HOST = 'fluera.aternos.me';
const PORT = 64885;

// Telegram Setup
const TG_TOKEN = '8870119757:AAGNgY0YRZgYTyYMo_iQBoavioSGJB-EJCo';
const TG_CHAT_ID = '7675471513';
const tgBot = new TelegramBot(TG_TOKEN, { polling: true });

// ── Global State ──────────────────────────
let bots = {}; // Sob bot er data ekhane thakbe
let logs = [];

function addLog(msg) {
    const time = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
    const logMessage = `[${time}] ${msg}`;
    console.log(logMessage);
    logs.unshift(logMessage);
    if (logs.length > 100) logs.pop();
}

// ── Telegram to Minecraft Bridge ──────────
tgBot.on('message', (msg) => {
    if (msg.chat.id.toString() === TG_CHAT_ID && msg.text) {
        // Find the first online bot to send the message
        const onlineBotName = Object.keys(bots).find(name => bots[name].status === 'Online');
        
        if (onlineBotName) {
            try {
                bots[onlineBotName].client.queue('text', {
                    type: 'chat',
                    needs_translation: false,
                    source_name: onlineBotName,
                    xuid: '',
                    platform_chat_id: '',
                    message: msg.text
                });
                addLog(`📨 [TG->MC] Sent by ${onlineBotName}: ${msg.text}`);
            } catch (err) {
                tgBot.sendMessage(TG_CHAT_ID, `❌ Error sending msg to MC: ${err.message}`);
            }
        } else {
            tgBot.sendMessage(TG_CHAT_ID, `⚠️ Kono bot ekhon server e online nai!`);
        }
    }
});

// ── Bot Core Function ─────────────────────
function spawnBot(botName) {
    if (bots[botName] && bots[botName].status === 'Online') return;

    addLog(`🔌 Starting bot: ${botName}...`);
    
    bots[botName] = {
        name: botName,
        status: 'Connecting...',
        position: 'Unknown',
        inventoryItems: 0,
        task: 'Idle',
        client: null,
        taskInterval: null
    };

    try {
        const client = bedrock.createClient({
            host: HOST,
            port: PORT,
            username: botName,
            offline: true,
            version: '1.21.0',
            skipPing: true,
            deviceOS: 1,
            deviceId: crypto.randomUUID(),
            connectTimeout: 30000
        });

        bots[botName].client = client;

        client.on('connect', () => {
            bots[botName].status = 'Joined Server';
        });

        client.on('spawn', () => {
            bots[botName].status = 'Online';
            tgBot.sendMessage(TG_CHAT_ID, `✅ Bot **${botName}** joined the server!`, { parse_mode: 'Markdown' });
            addLog(`✅ ${botName} spawned.`);
            
            // Anti-AFK
            client.afkInterval = setInterval(() => {
                try { client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: BigInt(Date.now()) }); } catch (e) {}
            }, 15000);
        });

        // Track Position from Server
        client.on('move_player', (packet) => {
            if (packet.runtime_id === client.entityId) {
                bots[botName].position = `X: ${Math.floor(packet.position.x)}, Y: ${Math.floor(packet.position.y)}, Z: ${Math.floor(packet.position.z)}`;
            }
        });

        // Track Minecraft Chat -> Telegram
        client.on('text', (packet) => {
            if (packet.type === 'chat' || packet.type === 'translation') {
                const msgText = packet.message;
                const sender = packet.source_name || 'Server';
                
                // Nije message dile ba ekadhik bot thakle double msg ignore korar jonno
                if (sender !== botName && Object.keys(bots)[0] === botName) { 
                    tgBot.sendMessage(TG_CHAT_ID, `💬 *[MC]* ${sender}: ${msgText}`, { parse_mode: 'Markdown' });
                }
            }
        });

        // Track Basic Inventory Update
        client.on('inventory_content', (packet) => {
            bots[botName].inventoryItems = packet.input.length; // Count items
        });

        client.on('disconnect', (packet) => {
            bots[botName].status = 'Offline';
            addLog(`❌ ${botName} Disconnected: ${packet.message}`);
            tgBot.sendMessage(TG_CHAT_ID, `❌ Bot **${botName}** disconnected!`, { parse_mode: 'Markdown' });
            cleanupBot(botName);
        });

        client.on('error', (err) => {
            bots[botName].status = 'Error';
            addLog(`⚠️ ${botName} Error: ${err.message}`);
            cleanupBot(botName);
        });

    } catch (err) {
        bots[botName].status = 'Failed';
        addLog(`❌ Client setup failed for ${botName}`);
    }
}

function cleanupBot(botName) {
    if (bots[botName]) {
        if (bots[botName].client) {
            try { bots[botName].client.close(); } catch(e) {}
            if (bots[botName].client.afkInterval) clearInterval(bots[botName].client.afkInterval);
        }
        if (bots[botName].taskInterval) clearInterval(bots[botName].taskInterval);
        bots[botName].status = 'Offline';
        bots[botName].client = null;
    }
}

function assignTask(botName, taskName) {
    if (!bots[botName] || bots[botName].status !== 'Online') return;
    
    bots[botName].task = taskName;
    if (bots[botName].taskInterval) clearInterval(bots[botName].taskInterval);
    
    if (taskName === 'Idle') return;
    
    // Task Simulation Loop (Check Reality Note in chat)
    bots[botName].taskInterval = setInterval(() => {
        if(bots[botName].status !== 'Online') return;
        try {
            bots[botName].client.queue('text', {
                type: 'chat', needs_translation: false, source_name: botName, xuid: '', platform_chat_id: '',
                message: `[Auto] I am currently doing task: ${taskName}`
            });
            addLog(`⛏️ ${botName} is performing task: ${taskName}`);
        } catch(e) {}
    }, 60000); // Sends a chat every 60 seconds as "proof" of task
}

// ── Web Dashboard (API + UI) ──────────────
http.createServer((req, res) => {
    // API: Get Bot Data
    if (req.url === '/api/bots') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const safeData = Object.keys(bots).map(b => ({
            name: bots[b].name,
            status: bots[b].status,
            position: bots[b].position,
            inventory: bots[b].inventoryItems,
            task: bots[b].task
        }));
        return res.end(JSON.stringify(safeData));
    }

    // API: Create Bot
    if (req.url.startsWith('/api/create?name=')) {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const name = urlParams.get('name');
        if (name) spawnBot(name);
        res.writeHead(200); return res.end('OK');
    }

    // API: Stop Bot
    if (req.url.startsWith('/api/stop?name=')) {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const name = urlParams.get('name');
        if (name) cleanupBot(name);
        res.writeHead(200); return res.end('OK');
    }

    // API: Set Task
    if (req.url.startsWith('/api/task?name=')) {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const name = urlParams.get('name');
        const task = urlParams.get('task');
        if (name && task) assignTask(name, task);
        res.writeHead(200); return res.end('OK');
    }

    // Web UI
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Zidan Bot - Control Panel</title>
      <style>
        body { background: #0f172a; color: #e2e8f0; font-family: sans-serif; padding: 20px; }
        .panel { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        input, button, select { padding: 8px; margin: 5px; border-radius: 4px; border: none; }
        button { background: #3b82f6; color: white; cursor: pointer; }
        button.stop { background: #ef4444; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; border-bottom: 1px solid #334155; text-align: left; }
        .online { color: #22c55e; font-weight: bold; }
        .offline { color: #ef4444; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>⚙️ Bot Control Panel</h2>
      
      <div class="panel">
        <h3>➕ Add New Bot</h3>
        <input type="text" id="botName" placeholder="Zidan_Bot_1">
        <button onclick="createBot()">Spawn Bot</button>
      </div>

      <div class="panel">
        <h3>🤖 Active Bots</h3>
        <table>
          <thead><tr><th>Name</th><th>Status</th><th>Pos (X,Y,Z)</th><th>Inv Items</th><th>Current Task</th><th>Actions</th></tr></thead>
          <tbody id="botTable"></tbody>
        </table>
      </div>

      <script>
        function createBot() {
            const name = document.getElementById('botName').value;
            if(!name) return alert('Enter a bot name!');
            fetch('/api/create?name=' + name).then(() => updateUI());
        }
        function stopBot(name) { fetch('/api/stop?name=' + name).then(() => updateUI()); }
        function setTask(name, selectElem) { fetch('/api/task?name=' + name + '&task=' + selectElem.value).then(() => updateUI()); }

        function updateUI() {
            fetch('/api/bots').then(r => r.json()).then(data => {
                const tbody = document.getElementById('botTable');
                tbody.innerHTML = '';
                data.forEach(b => {
                    const statusClass = b.status === 'Online' ? 'online' : 'offline';
                    tbody.innerHTML += \`
                        <tr>
                            <td>\${b.name}</td>
                            <td class="\${statusClass}">\${b.status}</td>
                            <td>\${b.position}</td>
                            <td>\${b.inventory}</td>
                            <td>
                                <select onchange="setTask('\${b.name}', this)">
                                    <option value="Idle" \${b.task === 'Idle'?'selected':''}>Idle / AFK</option>
                                    <option value="Chop Wood" \${b.task === 'Chop Wood'?'selected':''}>Chop Wood</option>
                                    <option value="Mine Dirt" \${b.task === 'Mine Dirt'?'selected':''}>Mine Dirt</option>
                                </select>
                            </td>
                            <td>
                                \${b.status === 'Online' || b.status === 'Connecting...' ? 
                                \`<button class="stop" onclick="stopBot('\${b.name}')">Stop</button>\` : 
                                \`<button onclick="fetch('/api/create?name=\${b.name}').then(updateUI)">Start</button>\`}
                            </td>
                        </tr>
                    \`;
                });
            });
        }
        setInterval(updateUI, 2000);
        updateUI();
      </script>
    </body>
    </html>
    `;
    res.end(html);
}).listen(process.env.PORT || 3000, () => {
    addLog('🌐 Web Control Panel Started on port ' + (process.env.PORT || 3000));
});
