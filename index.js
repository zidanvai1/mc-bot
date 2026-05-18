const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const bedrock = require('bedrock-protocol');

// ── Bot Configuration ─────────────────────────────────────────
const HOST = 'fluera.aternos.me';
const PORT = 64885;
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
const RECONNECT_DELAY = 20 * 1000;       // 20 seconds
const MAX_WOOD = 5;

// ── Global State & Log System ─────────────────────────────────
const logEmitter = new EventEmitter();
const logHistory = [];
let isBotEnabled = true; // Default e bot on thakbe
let reconnectCount = 0;
let woodCut = 0;
let currentClient = null;

function log(type, msg) {
  const entry = {
    time: new Date().toLocaleTimeString('bn-BD', { hour12: false, timeZone: 'Asia/Dhaka' }),
    type, // 'info' | 'success' | 'error' | 'warn' | 'action'
    msg
  };
  logHistory.push(entry);
  if (logHistory.length > 200) logHistory.shift();
  logEmitter.emit('log', entry);
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️', action: '🤖' };
  console.log(`${icons[type] || '▶'} [${entry.time}] ${msg}`);
}

// ── HTTP Server + Advanced Web UI ─────────────────────────────
const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Zidan Bot — Master Control</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700&display=swap');
  :root {
    --bg: #0a0c10; --panel: #0f1218; --border: #1e2530;
    --green: #00ff88; --red: #ff4455; --yellow: #ffcc00;
    --blue: #4af; --purple: #a78bfa; --dim: #4a5568;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:#cdd6f4; font-family:'Share Tech Mono',monospace; min-height:100vh; display:flex; flex-direction:column; }
  header { background:var(--panel); border-bottom:1px solid var(--border); padding:14px 24px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  header h1 { font-family:'Orbitron',sans-serif; font-size:1.3rem; color:var(--blue); letter-spacing:3px; text-shadow:0 0 12px #44aaff66; margin-right: auto; }
  .dot { width:10px; height:10px; border-radius:50%; background:var(--green); box-shadow:0 0 8px var(--green); animation:pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  
  /* Control Buttons */
  .controls { display: flex; gap: 10px; }
  .btn { font-family:'Share Tech Mono',monospace; font-weight:bold; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; transition: 0.2s; font-size: 0.85rem; }
  .btn-start { background-color: #00ff8822; color: var(--green); border: 1px solid var(--green); }
  .btn-start:hover { background-color: var(--green); color: #000; }
  .btn-stop { background-color: #ff445522; color: var(--red); border: 1px solid var(--red); }
  .btn-stop:hover { background-color: var(--red); color: #000; }

  .status-bar { display:flex; gap:24px; padding:10px 24px; background:#0d1017; border-bottom:1px solid var(--border); font-size:.75rem; flex-wrap:wrap; }
  .stat { display:flex; flex-direction:column; gap:2px; }
  .stat-label { color:var(--dim); font-size:.65rem; letter-spacing:1px; text-transform:uppercase; }
  .stat-value { color:var(--green); font-weight: bold; }
  #log-box { flex:1; overflow-y:auto; padding:16px 24px; display:flex; flex-direction:column; gap:4px; }
  .entry { display:flex; gap:10px; font-size:.85rem; line-height:1.5; padding:3px 0; border-bottom:1px solid #ffffff05; animation:fadein .3s ease; }
  @keyframes fadein { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
  .entry .t { color:var(--dim); min-width:70px; }
  .entry .m { flex:1; word-break:break-all; }
  .entry.success .m { color:var(--green); }
  .entry.error   .m { color:var(--red); }
  .entry.warn    .m { color:var(--yellow); }
  .entry.action  .m { color:var(--purple); }
  .entry.info    .m { color:#94a3b8; }
  footer { padding:8px 24px; font-size:.7rem; color:var(--dim); border-top:1px solid var(--border); background:var(--panel); }
</style>
</head>
<body>
<header>
  <div class="dot" id="dot"></div>
  <h1>ZIDAN BOT MASTER</h1>
  <div class="controls">
    <button class="btn btn-start" onclick="fetch('/action/start')">▶ START</button>
    <button class="btn btn-stop" onclick="fetch('/action/stop')">🛑 STOP</button>
  </div>
</header>
<div class="status-bar">
  <div class="stat"><span class="stat-label">Power</span><span class="stat-value" id="s-power">ON</span></div>
  <div class="stat"><span class="stat-label">Current Bot</span><span class="stat-value" id="s-name">—</span></div>
  <div class="stat"><span class="stat-label">Status</span><span class="stat-value" id="s-status">Connecting…</span></div>
  <div class="stat"><span class="stat-label">Session</span><span class="stat-value" id="s-session">0s</span></div>
  <div class="stat"><span class="stat-label">Reconnects</span><span class="stat-value" id="s-reconnects">0</span></div>
  <div class="stat"><span class="stat-label">Wood Cut</span><span class="stat-value" id="s-wood">0</span></div>
</div>
<div id="log-box"></div>
<footer>Auto-scrolls • Last 200 entries • Latest 2026 Evasion Enabled</footer>
<script>
  const box = document.getElementById('log-box');
  let atBottom = true;
  box.addEventListener('scroll', () => { atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40; });
  
  function addEntry(e) {
    const div = document.createElement('div');
    div.className = 'entry ' + e.type;
    div.innerHTML = '<span class="t">' + e.time + '</span><span class="m">' + e.msg + '</span>';
    box.appendChild(div);
    if (box.children.length > 200) box.children[0].remove();
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  fetch('/logs').then(r=>r.json()).then(arr => { arr.forEach(addEntry); box.scrollTop = box.scrollHeight; });

  const es = new EventSource('/stream');
  es.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.type === 'log') addEntry(d);
    if (d.type === 'stat') {
      if (d.power)      document.getElementById('s-power').textContent = d.power;
      if (d.power === 'OFF') document.getElementById('s-power').style.color = 'var(--red)';
      else if (d.power === 'ON') document.getElementById('s-power').style.color = 'var(--green)';
      
      if (d.name)       document.getElementById('s-name').textContent = d.name;
      if (d.status)     document.getElementById('s-status').textContent = d.status;
      if (d.reconnects !== undefined) document.getElementById('s-reconnects').textContent = d.reconnects;
      if (d.wood !== undefined)       document.getElementById('s-wood').textContent = d.wood;
    }
  };
  es.onerror = () => { document.getElementById('dot').style.background = 'var(--red)'; };

  let startTime = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now()-startTime)/1000);
    document.getElementById('s-session').textContent = Math.floor(s/60)+'m '+(s%60)+'s';
  }, 1000);
</script>
</body>
</html>`;

const sseClients = [];
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }
  if (req.url === '/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(logHistory));
  }
  if (req.url === '/action/start') {
    isBotEnabled = true;
    log('success', '▶ System: Bot Start Initiated by User');
    sendStat({ power: 'ON', status: 'Connecting...' });
    if (!currentClient || currentClient._ended) connectBot();
    res.writeHead(200); return res.end('Started');
  }
  if (req.url === '/action/stop') {
    isBotEnabled = false;
    log('warn', '🛑 System: Bot Force Stopped by User');
    sendStat({ power: 'OFF', status: 'Stopped via Panel' });
    if (currentClient && !currentClient._ended) currentClient.disconnect();
    res.writeHead(200); return res.end('Stopped');
  }
  if (req.url === '/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write(': connected\n\n');
    sseClients.push(res);
    req.on('close', () => {
      const i = sseClients.indexOf(res);
      if (i !== -1) sseClients.splice(i, 1);
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => { try { c.write(msg); } catch(e) {} });
}

logEmitter.on('log', entry => broadcast({ type: 'log', ...entry }));
function sendStat(obj) { broadcast({ type: 'stat', ...obj }); }

server.listen(process.env.PORT || 3000, () => log('success', `🌐 Control Panel Live: http://localhost:${process.env.PORT || 3000}`));

// ── Ping Bypass Patch ─────────────────────────────────────────
try {
  const rak = require(path.dirname(require.resolve('bedrock-protocol')) + '/src/rak');
  const _orig = rak.ping;
  rak.ping = async function(options) {
    try {
      return await Promise.race([
        _orig(options),
        new Promise(resolve => setTimeout(() => {
          log('warn', '⚡ Ping timeout intercepted. Forcing fake response...');
          resolve({ version:'1.21.0', protocolVersion:748, name:'Aternos', playersOnline:0, playersMax:20 });
        }, 2500))
      ]);
    } catch(e) {
      log('warn', `⚡ Ping failed (${e.message}). Direct bypassing...`);
      return { version:'1.21.0', protocolVersion:748, name:'Aternos', playersOnline:0, playersMax:20 };
    }
  };
  log('info', '🔧 Deep Ping Bypass Module Loaded');
} catch(e) { log('error', 'Ping patch error: ' + e.message); }

// ── Bot Behaviour (Simulated) ─────────────────────────────────
function startBehaviour(client) {
  woodCut = 0;
  sendStat({ wood: 0 });

  // 1. Tick Sync (Anti-AFK 2026 Method)
  const afkInterval = setInterval(() => {
    if (!client || client._ended) return clearInterval(afkInterval);
    try {
      client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: BigInt(Date.now()) });
    } catch(e) {}
  }, 15000);
  client.afkInterval = afkInterval;

  // 2. Random Look & Walk
  const walkInterval = setInterval(() => {
    if (!client || client._ended) return clearInterval(walkInterval);
    try {
      const yaw = Math.random() * 360;
      client.queue('move_player', {
        runtime_id: 1n, position: { x: (Math.random()-0.5)*2, y: 64, z: (Math.random()-0.5)*2 },
        pitch: (Math.random() - 0.5) * 40, yaw, head_yaw: yaw, mode: 0, on_ground: true, riding_runtime_id: 0n, tick: BigInt(Date.now())
      });
      log('action', `🚶 Bot pacing randomly (Yaw: ${yaw.toFixed(1)}°)`);
    } catch(e) {}
  }, 5000 + Math.random() * 3000);
  client.walkInterval = walkInterval;

  // 3. Tree Searching & Cutting Simulation
  const treeInterval = setInterval(() => {
    if (!client || client._ended) return clearInterval(treeInterval);
    if (woodCut >= MAX_WOOD) return;
    if (Math.random() < 0.4) {
      woodCut++;
      sendStat({ wood: woodCut });
      log('action', `🪓 Found & cut tree block! Wood: ${woodCut}/${MAX_WOOD}`);
      if (woodCut >= MAX_WOOD) {
        log('action', `📦 Max wood reached. Auto-storing in chest near 0,0...`);
        try { client.queue('animate', { action_id: 1, runtime_entity_id: 1n }); } catch(e) {}
        log('success', `✅ Wood stored successfully.`);
        clearInterval(treeInterval);
      }
    }
  }, 15000);
  client.treeInterval = treeInterval;
}

// ── Connection Core ───────────────────────────────────────────
function connectBot() {
  if (!isBotEnabled) return; // UI theke stop kora thakle join korbe na

  const username = 'Zidan_Bot_' + Math.floor(1000 + Math.random() * 9000);
  const fakeDeviceId = crypto.randomUUID(); // Device spoofing
  reconnectCount++;
  
  sendStat({ name: username, status: 'Handshaking...', reconnects: reconnectCount });
  log('info', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log('info', `🔌 Initializing ${username} | 📱 Spoof ID: ${fakeDeviceId}`);

  let client;
  try {
    client = bedrock.createClient({
      host: HOST,
      port: PORT,
      username,
      offline: true,
      version: '1.21.0',
      connectTimeout: 30000,
      skipPing: true, // Ping Bypass
      deviceOS: 1,    // Spoofing as Android Phone
      deviceId: fakeDeviceId 
    });
    currentClient = client;
    client._ended = false;
  } catch(err) {
    log('error', `Connection build failed: ${err.message}`);
    sendStat({ status: 'Build Error' });
    if (isBotEnabled) setTimeout(connectBot, RECONNECT_DELAY);
    return;
  }

  // 30 Min Timer
  const sessionTimer = setTimeout(() => {
    if(!client._ended) {
      log('warn', `⏰ 30-min cycle complete. Cycling bot...`);
      sendStat({ status: 'Session End' });
      client.disconnect(); 
    }
  }, SESSION_DURATION);
  client.sessionTimer = sessionTimer;

  client.on('connect', () => {
    log('success', `🔗 RakNet connected securely`);
    sendStat({ status: 'Logging in...' });
  });

  client.on('spawn', () => {
    log('success', `✅ ${username} spawned in the server!`);
    sendStat({ status: 'Online ✅' });
    startBehaviour(client);
  });

  client.on('disconnect', (packet) => {
    client._ended = true;
    clearTimeout(client.sessionTimer);
    if(client.afkInterval) clearInterval(client.afkInterval);
    if(client.walkInterval) clearInterval(client.walkInterval);
    if(client.treeInterval) clearInterval(client.treeInterval);
    
    if (!isBotEnabled) return; // User zodi nije stop kore thake tahole auto-reconnect hobe na
    
    log('error', `Disconnected by Server: ${packet.message || 'Unknown'}`);
    sendStat({ status: 'Disconnected' });
    log('info', `🔄 Preparing new bot in 20 seconds...`);
    setTimeout(connectBot, RECONNECT_DELAY);
  });

  client.on('error', (err) => {
    client._ended = true;
    clearTimeout(client.sessionTimer);
    if(client.afkInterval) clearInterval(client.afkInterval);
    
    if (!isBotEnabled) return;
    
    log('error', `Network Error: ${err.message}`);
    sendStat({ status: 'Network Error' });
    try { client.close(); } catch(e) {}
    setTimeout(connectBot, RECONNECT_DELAY);
  });
}

// Auto-start on run
connectBot();
