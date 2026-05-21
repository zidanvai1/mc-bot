const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto');
const dns = require('dns');
const dgram = require('dgram');
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const HOST = 'fluera.aternos.me';
const PORT = 64885;
const TG_TOKEN = process.env.BOT_TOKEN;
const TG_CHAT_ID = '7675471513';

const tgBot = new TelegramBot(TG_TOKEN, { polling: true });

// ── Logger ───────────────────────────────
let logs = [];
const LEVELS = {
  INFO:    { icon: 'ℹ️',  color: '#22d3ee' },
  SUCCESS: { icon: '✅',  color: '#4ade80' },
  WARN:    { icon: '⚠️',  color: '#fbbf24' },
  ERROR:   { icon: '❌',  color: '#f87171' },
  DEBUG:   { icon: '🔍', color: '#a78bfa' },
  NET:     { icon: '🌐',  color: '#38bdf8' },
  TG:      { icon: '📱',  color: '#fb923c' },
  MC:      { icon: '🎮',  color: '#34d399' },
};

function addLog(msg, level = 'INFO') {
  const time = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
  const { icon, color } = LEVELS[level] || LEVELS.INFO;
  const entry = { time, msg, icon, color, level };
  console.log(`[${time}] ${icon} [${level}] ${msg}`);
  logs.unshift(entry);
  if (logs.length > 200) logs.pop();
}

// ── Stats ────────────────────────────────
const stats = {
  totalAttempts: 0,
  successJoins: 0,
  totalErrors: 0,
  lastError: 'N/A',
  lastJoin: 'N/A',
  uptime: Date.now(),
  dnsResolved: false,
  udpReachable: 'Unknown',
  currentBot: 'N/A',
  isInGame: false,
};

// ── DNS Check ────────────────────────────
async function checkDNS() {
  return new Promise((resolve) => {
    addLog(`DNS Lookup: ${HOST}`, 'DEBUG');
    dns.lookup(HOST, (err, address) => {
      if (err) {
        addLog(`DNS FAILED: ${err.message}`, 'ERROR');
        stats.dnsResolved = false;
        resolve(null);
      } else {
        addLog(`DNS OK → ${address}`, 'SUCCESS');
        stats.dnsResolved = true;
        resolve(address);
      }
    });
  });
}

// ── UDP Reachability Test ────────────────
async function checkUDP(ip) {
  return new Promise((resolve) => {
    addLog(`UDP Test → ${ip}:${PORT}`, 'DEBUG');
    const sock = dgram.createSocket('udp4');
    const timeout = setTimeout(() => {
      addLog('UDP Test: TIMEOUT (Render blocks UDP!)', 'WARN');
      stats.udpReachable = '❌ BLOCKED/TIMEOUT';
      sock.close();
      resolve(false);
    }, 5000);

    // Unconnected Ping (RakNet offline ping)
    const ping = Buffer.from([
      0x01,
      ...Buffer.alloc(8), // time
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe,
      0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
      ...Buffer.alloc(8)
    ]);

    sock.on('message', () => {
      clearTimeout(timeout);
      addLog('UDP Test: REACHABLE ✅', 'SUCCESS');
      stats.udpReachable = '✅ REACHABLE';
      sock.close();
      resolve(true);
    });

    sock.on('error', (e) => {
      clearTimeout(timeout);
      addLog(`UDP Test ERROR: ${e.message}`, 'ERROR');
      stats.udpReachable = `❌ ERROR: ${e.message}`;
      resolve(false);
    });

    try {
      sock.send(ping, PORT, ip);
    } catch (e) {
      clearTimeout(timeout);
      addLog(`UDP Send ERROR: ${e.message}`, 'ERROR');
      stats.udpReachable = `❌ SEND FAIL`;
      resolve(false);
    }
  });
}

// ── Web Dashboard ────────────────────────
http.createServer((req, res) => {
  if (req.url === '/api/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(logs.slice(0, 50)));
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  const upSec = Math.floor((Date.now() - stats.uptime) / 1000);
  const upStr = `${Math.floor(upSec/3600)}h ${Math.floor((upSec%3600)/60)}m ${upSec%60}s`;

  const logRows = logs.map(l =>
    `<div class="log-row" style="border-left:3px solid ${l.color}20;padding-left:8px">
      <span class="time">${l.time}</span>
      <span style="color:${l.color}">${l.icon} [${l.level}]</span>
      <span>${l.msg}</span>
    </div>`
  ).join('');

  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Zidan Bot - Dashboard</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0f172a;color:#e2e8f0;font-family:monospace;padding:16px;font-size:13px}
    h2{color:#f8fafc;text-align:center;margin-bottom:12px;font-size:16px}
    .stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
    .stat-card{background:#1e293b;border:1px solid #334155;border-radius:6px;padding:10px}
    .stat-label{color:#94a3b8;font-size:11px}
    .stat-value{color:#22d3ee;font-size:14px;font-weight:bold;margin-top:2px;word-break:break-all}
    .stat-value.ok{color:#4ade80}
    .stat-value.err{color:#f87171}
    .stat-value.warn{color:#fbbf24}
    .log-container{background:#020617;border:1px solid #334155;border-radius:6px;
      height:55vh;overflow-y:auto;padding:10px}
    .log-row{padding:3px 0;border-bottom:1px solid #1e293b10;line-height:1.6}
    .time{color:#475569;margin-right:6px}
    .filter-bar{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
    .filter-btn{background:#1e293b;border:1px solid #334155;color:#94a3b8;
      padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px}
    .filter-btn.active{background:#0284c7;color:white;border-color:#0284c7}
    #refresh-info{color:#475569;font-size:11px;text-align:right;margin-bottom:6px}
  </style>
</head>
<body>
  <h2>🤖 Zidan Bot — Advanced Dashboard</h2>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Bot Status</div>
      <div class="stat-value ${stats.isInGame ? 'ok' : 'err'}">${stats.isInGame ? '🎮 IN GAME' : '🔌 OFFLINE'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Current Bot</div>
      <div class="stat-value">${stats.currentBot}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">DNS Resolved</div>
      <div class="stat-value ${stats.dnsResolved ? 'ok' : 'err'}">${stats.dnsResolved ? '✅ YES' : '❌ NO'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">UDP Reachable</div>
      <div class="stat-value warn">${stats.udpReachable}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Join Attempts / Success</div>
      <div class="stat-value">${stats.totalAttempts} / <span class="ok">${stats.successJoins}</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Errors | Last Error</div>
      <div class="stat-value err">${stats.totalErrors} — ${stats.lastError}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Last Join</div>
      <div class="stat-value ok">${stats.lastJoin}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Uptime</div>
      <div class="stat-value">${upStr}</div>
    </div>
  </div>

  <div id="refresh-info">Auto-refresh: 3s</div>
  <div class="filter-bar" id="filters">
    <button class="filter-btn active" onclick="setFilter('ALL')">ALL</button>
    <button class="filter-btn" onclick="setFilter('ERROR')">❌ ERROR</button>
    <button class="filter-btn" onclick="setFilter('WARN')">⚠️ WARN</button>
    <button class="filter-btn" onclick="setFilter('NET')">🌐 NET</button>
    <button class="filter-btn" onclick="setFilter('MC')">🎮 MC</button>
    <button class="filter-btn" onclick="setFilter('TG')">📱 TG</button>
    <button class="filter-btn" onclick="setFilter('DEBUG')">🔍 DEBUG</button>
  </div>
  <div class="log-container" id="logs">${logRows}</div>

  <script>
    let activeFilter = 'ALL';
    function setFilter(f) {
      activeFilter = f;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
    }
    async function refresh() {
      try {
        const data = await fetch('/api/logs').then(r=>r.json());
        const filtered = activeFilter === 'ALL' ? data : data.filter(l => l.level === activeFilter);
        document.getElementById('logs').innerHTML = filtered.map(l =>
          '<div class="log-row" style="border-left:3px solid '+l.color+'20;padding-left:8px">' +
          '<span class="time">'+l.time+'</span>' +
          '<span style="color:'+l.color+'">'+l.icon+' ['+l.level+']</span> ' +
          '<span>'+l.msg+'</span></div>'
        ).join('');
      } catch(e) {}
      document.getElementById('refresh-info').textContent = 'Last refresh: ' + new Date().toLocaleTimeString();
    }
    setInterval(refresh, 3000);
  </script>
</body>
</html>`);
}).listen(process.env.PORT || 3000, () => {
  addLog('Web Server Started on port ' + (process.env.PORT || 3000), 'SUCCESS');
});

// ── Bot State ────────────────────────────
let activeClient = null;
let reconnectTimer = null;

// ── TG → MC ──────────────────────────────
tgBot.on('message', (msg) => {
  if (String(msg.chat.id) !== TG_CHAT_ID) return;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  if (!stats.isInGame || !activeClient) {
    tgBot.sendMessage(TG_CHAT_ID, '⚠️ Bot এখন game-এ নেই।');
    return;
  }
  try {
    activeClient.queue('text', {
      type: 'chat',
      needs_translation: false,
      source_name: activeClient.username,
      xuid: '', platform_chat_id: '',
      message: text,
    });
    addLog(`TG→MC: ${text}`, 'TG');
  } catch (e) {
    addLog(`TG→MC Send Error: ${e.message}`, 'ERROR');
  }
});

// ── Main Connect ─────────────────────────
async function connectBot() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  addLog('━━━━━━━━━━━ New Session ━━━━━━━━━━━', 'INFO');
  stats.totalAttempts++;

  // Step 1: DNS
  const ip = await checkDNS();
  if (!ip) {
    addLog('DNS failed → retry in 30s', 'WARN');
    reconnectTimer = setTimeout(connectBot, 30000);
    return;
  }

  // Step 2: UDP test
  await checkUDP(ip);
  // UDP blocked মানে Render-এ কাজ করবে না, তবু try করি (logging এর জন্য)

  // Step 3: Connect
  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  const botName = `Zidan_Bot_${randomNum}`;
  const fakeDeviceId = crypto.randomUUID();
  stats.currentBot = botName;

  addLog(`Connecting as ${botName}`, 'NET');
  addLog(`Device ID: ${fakeDeviceId}`, 'DEBUG');

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
      connectTimeout: 30000,
    });
  } catch (err) {
    addLog(`Client create error: ${err.message}`, 'ERROR');
    stats.totalErrors++;
    stats.lastError = err.message;
    reconnectTimer = setTimeout(connectBot, 20000);
    return;
  }

  client.on('connect', () => addLog('RakNet handshake started...', 'NET'));

  client.on('spawn', () => {
    addLog(`${botName} spawned in game!`, 'SUCCESS');
    stats.successJoins++;
    stats.isInGame = true;
    stats.lastJoin = new Date().toLocaleTimeString();
    activeClient = client;

    tgBot.sendMessage(TG_CHAT_ID,
      `✅ *${botName}* game এ join করেছে!\n⏰ ${stats.lastJoin}`,
      { parse_mode: 'Markdown' }
    );

    // MC → TG
    client.on('text', (packet) => {
      if (!stats.isInGame) return;
      const sender = packet.source_name || '';
      const message = packet.message || '';
      if (sender === botName || !message.trim()) return;

      const formatted = sender ? `💬 *${sender}*: ${message}` : `📢 ${message}`;
      addLog(`MC→TG: ${sender ? sender+': ' : ''}${message}`, 'MC');
      tgBot.sendMessage(TG_CHAT_ID, formatted, { parse_mode: 'Markdown' })
        .catch(() => tgBot.sendMessage(TG_CHAT_ID, `💬 ${sender}: ${message}`));
    });

    // Anti-AFK
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', {
          request_time: BigInt(Date.now()),
          response_time: BigInt(Date.now()),
        });
      } catch (e) {}
    }, 15000);
    client._afk = afkInterval;
  });

  const cleanup = (reason) => {
    if (client._afk) clearInterval(client._afk);
    stats.isInGame = false;
    activeClient = null;
    reconnectTimer = setTimeout(connectBot, 20000);
    addLog(`Reconnect scheduled in 20s. Reason: ${reason}`, 'WARN');
  };

  client.on('disconnect', (packet) => {
    const msg = packet?.message || 'Unknown';
    addLog(`Disconnected: ${msg}`, 'ERROR');
    stats.totalErrors++;
    stats.lastError = `Disconnect: ${msg}`;
    tgBot.sendMessage(TG_CHAT_ID, `❌ Bot disconnect: ${msg}`);
    cleanup(msg);
  });

  client.on('error', (err) => {
    addLog(`Error: ${err.message}`, 'ERROR');
    stats.totalErrors++;
    stats.lastError = err.message;

    // Error diagnosis
    if (err.message.includes('timed out')) {
      addLog('DIAGNOSIS: UDP blocked (Render free tier বা firewall)', 'WARN');
      addLog('FIX: Railway/Fly.io/VPS ব্যবহার করুন যেখানে UDP open', 'WARN');
    } else if (err.message.includes('ECONNREFUSED')) {
      addLog('DIAGNOSIS: Server offline (Aternos ঘুমাচ্ছে?)', 'WARN');
    } else if (err.message.includes('ENOTFOUND')) {
      addLog('DIAGNOSIS: DNS resolve হচ্ছে না', 'WARN');
    }

    try { client.close(); } catch (e) {}
    cleanup(err.message);
  });
}

// ── Start ────────────────────────────────
addLog('Zidan Bot starting...', 'INFO');
connectBot();
