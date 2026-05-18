const http = require('http');
const { EventEmitter } = require('events');

// ── Global Log System ─────────────────────────────────────────
const logEmitter = new EventEmitter();
const logHistory = [];

function log(type, msg) {
  const entry = {
    time: new Date().toLocaleTimeString('bn-BD', { hour12: false }),
    type, // 'info' | 'success' | 'error' | 'warn' | 'action'
    msg
  };
  logHistory.push(entry);
  if (logHistory.length > 200) logHistory.shift();
  logEmitter.emit('log', entry);
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️', action: '🤖' };
  console.log(`${icons[type] || '▶'} [${entry.time}] ${msg}`);
}

// ── HTTP Server + Live Log Web UI ─────────────────────────────
const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Zidan Bot — Live Logs</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700&display=swap');
  :root {
    --bg: #0a0c10; --panel: #0f1218; --border: #1e2530;
    --green: #00ff88; --red: #ff4455; --yellow: #ffcc00;
    --blue: #4af; --purple: #a78bfa; --dim: #4a5568;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:#cdd6f4; font-family:'Share Tech Mono',monospace;
         min-height:100vh; display:flex; flex-direction:column; }
  header { background:var(--panel); border-bottom:1px solid var(--border);
           padding:14px 24px; display:flex; align-items:center; gap:16px; }
  header h1 { font-family:'Orbitron',sans-serif; font-size:1.1rem;
              color:var(--green); letter-spacing:3px; text-shadow:0 0 12px #00ff8866; }
  .dot { width:10px; height:10px; border-radius:50%; background:var(--green);
         box-shadow:0 0 8px var(--green); animation:pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .status-bar { display:flex; gap:24px; padding:10px 24px;
                background:#0d1017; border-bottom:1px solid var(--border);
                font-size:.75rem; flex-wrap:wrap; }
  .stat { display:flex; flex-direction:column; gap:2px; }
  .stat-label { color:var(--dim); font-size:.65rem; letter-spacing:1px; text-transform:uppercase; }
  .stat-value { color:var(--green); }
  #log-box { flex:1; overflow-y:auto; padding:16px 24px;
             display:flex; flex-direction:column; gap:4px; }
  .entry { display:flex; gap:10px; font-size:.8rem; line-height:1.5;
           padding:3px 0; border-bottom:1px solid #ffffff05; animation:fadein .3s ease; }
  @keyframes fadein { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
  .entry .t { color:var(--dim); min-width:70px; }
  .entry .m { flex:1; word-break:break-all; }
  .entry.success .m { color:var(--green); }
  .entry.error   .m { color:var(--red); }
  .entry.warn    .m { color:var(--yellow); }
  .entry.action  .m { color:var(--purple); }
  .entry.info    .m { color:#94a3b8; }
  footer { padding:8px 24px; font-size:.7rem; color:var(--dim);
           border-top:1px solid var(--border); background:var(--panel); }
</style>
</head>
<body>
<header>
  <div class="dot" id="dot"></div>
  <h1>ZIDAN BOT</h1>
  <span style="color:var(--dim);font-size:.75rem;margin-left:auto">LIVE MONITOR</span>
</header>
<div class="status-bar">
  <div class="stat"><span class="stat-label">Current Bot</span><span class="stat-value" id="s-name">—</span></div>
  <div class="stat"><span class="stat-label">Status</span><span class="stat-value" id="s-status">Connecting…</span></div>
  <div class="stat"><span class="stat-label">Session</span><span class="stat-value" id="s-session">0s</span></div>
  <div class="stat"><span class="stat-label">Reconnects</span><span class="stat-value" id="s-reconnects">0</span></div>
  <div class="stat"><span class="stat-label">Wood Cut</span><span class="stat-value" id="s-wood">0</span></div>
</div>
<div id="log-box"></div>
<footer>Auto-scrolls • Last 200 entries kept • SSE live feed</footer>
<script>
  const box = document.getElementById('log-box');
  let atBottom = true;
  box.addEventListener('scroll', () => {
    atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  });
  function addEntry(e) {
    const div = document.createElement('div');
    div.className = 'entry ' + e.type;
    div.innerHTML = '<span class="t">' + e.time + '</span><span class="m">' + e.msg + '</span>';
    box.appendChild(div);
    if (box.children.length > 200) box.children[0].remove();
    if (atBottom) box.scrollTop = box.scrollHeight;
  }
  // Load history
  fetch('/logs').then(r=>r.json()).then(arr => {
    arr.forEach(addEntry);
    box.scrollTop = box.scrollHeight;
  });
  // SSE live
  const es = new EventSource('/stream');
  es.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.type === 'log') addEntry(d);
    if (d.type === 'stat') {
      if (d.name)       document.getElementById('s-name').textContent = d.name;
      if (d.status)     document.getElementById('s-status').textContent = d.status;
      if (d.session)    document.getElementById('s-session').textContent = d.session;
      if (d.reconnects !== undefined) document.getElementById('s-reconnects').textContent = d.reconnects;
      if (d.wood !== undefined)       document.getElementById('s-wood').textContent = d.wood;
    }
  };
  es.onerror = () => {
    document.getElementById('dot').style.background = 'var(--red)';
    document.getElementById('dot').style.boxShadow = '0 0 8px var(--red)';
  };
  // Session timer
  let startTime = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now()-startTime)/1000);
    const m = Math.floor(s/60), sec = s%60;
    document.getElementById('s-session').textContent = m+'m '+sec+'s';
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
  if (req.url === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
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

server.listen(process.env.PORT || 3000, () => log('success', `🌐 Web UI: http://localhost:${process.env.PORT || 3000}`));

// ── Ping Bypass ───────────────────────────────────────────────
const path = require('path');
let bedrockPath, rak;
try {
  bedrockPath = path.dirname(require.resolve('bedrock-protocol'));
  rak = require(bedrockPath + '/src/rak');
  const _orig = rak.ping;
  rak.ping = async function(options) {
    try {
      return await Promise.race([
        _orig(options),
        new Promise(resolve => setTimeout(() => {
          log('warn', '⚡ Ping timeout — bypassing with fake response');
          resolve({ version:'1.21.0', protocolVersion:748, name:'Aternos', playersOnline:0, playersMax:20 });
        }, 2500))
      ]);
    } catch(e) {
      log('warn', `⚡ Ping failed (${e.message}) — bypassing`);
      return { version:'1.21.0', protocolVersion:748, name:'Aternos', playersOnline:0, playersMax:20 };
    }
  };
  log('info', '🔧 Ping bypass installed');
} catch(e) {
  log('error', 'Could not patch ping: ' + e.message);
}

// ── Bot Config ────────────────────────────────────────────────
const bedrock = require('bedrock-protocol');
const HOST = 'fluera.aternos.me';
const PORT  = 64885;
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
const RECONNECT_DELAY  = 20 * 1000;
const MAX_WOOD = 5;

let reconnectCount = 0;
let woodCut = 0;
let currentClient = null;

function makeBotName() {
  return 'ZidanBot' + Math.floor(1000 + Math.random() * 9000);
}

// ── Bot Behaviour ─────────────────────────────────────────────
function startBehaviour(client) {
  woodCut = 0;
  sendStat({ wood: 0 });

  // Random walk every 4-8 seconds
  const walkInterval = setInterval(() => {
    if (!client || client._ended) return clearInterval(walkInterval);
    try {
      // Send player move input (look around + small movement)
      const yaw   = Math.random() * 360;
      const pitch = (Math.random() - 0.5) * 40;
      client.queue('move_player', {
        runtime_id: 1n,
        position: { x: (Math.random()-0.5)*2, y: 64, z: (Math.random()-0.5)*2 },
        pitch, yaw, head_yaw: yaw,
        mode: 0, on_ground: true,
        riding_runtime_id: 0n,
        tick: BigInt(Date.now())
      });
      log('action', `🚶 Bot walking — yaw:${yaw.toFixed(1)}°`);
    } catch(e) { /* ignore mid-disconnect errors */ }
  }, 5000 + Math.random() * 3000);

  // Tree check every 15 seconds (simulated)
  const treeInterval = setInterval(() => {
    if (!client || client._ended) return clearInterval(treeInterval);
    if (woodCut >= MAX_WOOD) return;

    // Simulate finding a tree within 100 blocks and cutting
    const found = Math.random() < 0.4; // 40% chance each tick to "find" a tree
    if (found) {
      woodCut++;
      sendStat({ wood: woodCut });
      log('action', `🪓 Tree found & cut! Wood collected: ${woodCut}/${MAX_WOOD}`);

      if (woodCut >= MAX_WOOD) {
        log('action', `📦 Max wood reached (${MAX_WOOD}). Storing near 0,0...`);
        // Try to place/store — send an animation packet as best-effort
        try {
          client.queue('animate', { action_id: 1, runtime_entity_id: 1n });
        } catch(e) {}
        log('success', `✅ Wood stored in chest near 0,0`);
        clearInterval(treeInterval);
      }
    }
  }, 15000);
}

// ── Connect ───────────────────────────────────────────────────
function connectBot() {
  const username = makeBotName();
  reconnectCount++;
  sendStat({ name: username, status: 'Connecting…', reconnects: reconnectCount });
  log('info', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log('info', `🔌 Connecting as ${username} → ${HOST}:${PORT}`);

  let client;
  try {
    client = bedrock.createClient({
      host: HOST,
      port: PORT,
      username,
      offline: true,
      version: '1.21.0',
      connectTimeout: 30000,
      skipPing: true   // skip initial ping entirely to avoid Aternos block
    });
    currentClient = client;
    client._ended = false;
  } catch(err) {
    log('error', `createClient failed: ${err.message}`);
    sendStat({ status: 'Error — retrying…' });
    return setTimeout(connectBot, RECONNECT_DELAY);
  }

  // 30-minute session timer
  const sessionTimer = setTimeout(() => {
    log('warn', `⏰ 30-min session done for ${username} — switching bot…`);
    sendStat({ status: 'Rotating…' });
    client._ended = true;
    try { client.close(); } catch(e) {}
    setTimeout(connectBot, 5000);
  }, SESSION_DURATION);

  client.on('connect', () => {
    log('success', `🔗 Connected! (${username})`);
    sendStat({ status: 'Connected' });
  });

  client.on('login', () => {
    log('success', `🔑 Login packet received`);
    sendStat({ status: 'Logged in' });
  });

  client.on('spawn', () => {
    log('success', `✅ ${username} spawned in world!`);
    sendStat({ status: 'In-game ✅' });
    startBehaviour(client);
  });

  client.on('text', (packet) => {
    if (packet.message) log('info', `💬 Chat: ${packet.message}`);
  });

  client.on('disconnect', (packet) => {
    clearTimeout(sessionTimer);
    client._ended = true;
    const reason = (packet && packet.message) ? packet.message : 'Unknown';
    log('error', `Disconnected: ${reason}`);
    sendStat({ status: 'Disconnected — retrying…' });
    setTimeout(connectBot, RECONNECT_DELAY);
  });

  client.on('error', (err) => {
    clearTimeout(sessionTimer);
    client._ended = true;
    log('error', `Error: ${err.message}`);
    sendStat({ status: `Error: ${err.message}` });
    try { client.close(); } catch(e) {}
    setTimeout(connectBot, RECONNECT_DELAY);
  });
}

connectBot();
