const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto');
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const HOST = 'fluera.aternos.me';
const PORT = 64885;
const TG_TOKEN = process.env.BOT_TOKEN;
const TG_CHAT_ID = '7675471513';

// ── Telegram — polling conflict fix ─────
// আগে পুরনো webhook/session clear করো
const tgBot = new TelegramBot(TG_TOKEN, {
  polling: {
    interval: 2000,
    autoStart: false,   // manual start করবো
    params: { timeout: 10 }
  }
});

async function startTelegramBot() {
  try {
    // পুরনো webhook delete করো
    await tgBot.deleteWebHook();
    addLog('Telegram webhook cleared', 'INFO');
    // এখন polling শুরু করো
    await tgBot.startPolling();
    addLog('Telegram polling started ✅', 'SUCCESS');
  } catch (e) {
    addLog(`Telegram start error: ${e.message}`, 'WARN');
    // 10 সেকেন্ড পর retry
    setTimeout(startTelegramBot, 10000);
  }
}

tgBot.on('polling_error', (err) => {
  addLog(`TG Polling Error: ${err.message}`, 'WARN');
  if (err.message && err.message.includes('409')) {
    addLog('409 Conflict — দুটো instance চলছে! Render এ পুরনো deploy বন্ধ করুন।', 'ERROR');
    // polling বন্ধ করে retry
    tgBot.stopPolling().then(() => {
      setTimeout(startTelegramBot, 15000);
    });
  }
});

// ── Logger ───────────────────────────────
let logs = [];
const LEVELS = {
  INFO:    { icon: 'ℹ️',  color: '#22d3ee' },
  SUCCESS: { icon: '✅',  color: '#4ade80' },
  WARN:    { icon: '⚠️',  color: '#fbbf24' },
  ERROR:   { icon: '❌',  color: '#f87171' },
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
  currentBot: 'N/A',
  isInGame: false,
};

// ── Web Dashboard ────────────────────────
http.createServer((req, res) => {
  if (req.url === '/api/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(logs.slice(0, 100)));
  }

  const upSec = Math.floor((Date.now() - stats.uptime) / 1000);
  const upStr = `${Math.floor(upSec/3600)}h ${Math.floor((upSec%3600)/60)}m ${upSec%60}s`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Zidan Bot</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0f172a;color:#e2e8f0;font-family:monospace;padding:16px;font-size:13px}
    h2{color:#f8fafc;text-align:center;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
    .card{background:#1e293b;border:1px solid #334155;border-radius:6px;padding:10px}
    .label{color:#94a3b8;font-size:11px}
    .val{color:#22d3ee;font-size:14px;font-weight:bold;margin-top:2px}
    .ok{color:#4ade80}.err{color:#f87171}.warn{color:#fbbf24}
    .filters{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
    .btn{background:#1e293b;border:1px solid #334155;color:#94a3b8;
         padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px}
    .btn.active{background:#0284c7;color:#fff;border-color:#0284c7}
    .logs{background:#020617;border:1px solid #334155;border-radius:6px;
          height:55vh;overflow-y:auto;padding:10px}
    .row{padding:3px 0;border-bottom:1px solid #ffffff08;line-height:1.6}
    .t{color:#475569;margin-right:6px}
    #info{color:#475569;font-size:11px;text-align:right;margin-bottom:6px}
  </style>
</head>
<body>
  <h2>🤖 Zidan Bot — Dashboard</h2>
  <div class="grid">
    <div class="card">
      <div class="label">Bot Status</div>
      <div class="val">${stats.isInGame
        ? '<span class="ok">🎮 IN GAME</span>'
        : '<span class="err">🔌 OFFLINE</span>'}</div>
    </div>
    <div class="card">
      <div class="label">Current Bot</div>
      <div class="val">${stats.currentBot}</div>
    </div>
    <div class="card">
      <div class="label">Attempts / Joins</div>
      <div class="val">${stats.totalAttempts} / <span class="ok">${stats.successJoins}</span></div>
    </div>
    <div class="card">
      <div class="label">Errors</div>
      <div class="val err">${stats.totalErrors}</div>
    </div>
    <div class="card">
      <div class="label">Last Join</div>
      <div class="val ok">${stats.lastJoin}</div>
    </div>
    <div class="card">
      <div class="label">Last Error</div>
      <div class="val err" style="font-size:11px">${stats.lastError}</div>
    </div>
    <div class="card" style="grid-column:span 2">
      <div class="label">Uptime</div>
      <div class="val">${upStr}</div>
    </div>
  </div>
  <div id="info">Auto-refresh: 3s</div>
  <div class="filters">
    <button class="btn active" onclick="setFilter('ALL',this)">ALL</button>
    <button class="btn" onclick="setFilter('ERROR',this)">❌ ERROR</button>
    <button class="btn" onclick="setFilter('WARN',this)">⚠️ WARN</button>
    <button class="btn" onclick="setFilter('MC',this)">🎮 MC</button>
    <button class="btn" onclick="setFilter('TG',this)">📱 TG</button>
    <button class="btn" onclick="setFilter('SUCCESS',this)">✅ OK</button>
  </div>
  <div class="logs" id="logs"></div>
  <script>
    let af='ALL';
    function setFilter(f,el){
      af=f;
      document.querySelectorAll('.btn').forEach(b=>b.classList.remove('active'));
      el.classList.add('active');
    }
    async function refresh(){
      try{
        const data=await fetch('/api/logs').then(r=>r.json());
        const rows=(af==='ALL'?data:data.filter(l=>l.level===af))
          .map(l=>'<div class="row" style="border-left:3px solid '+l.color+'30;padding-left:8px">'+
            '<span class="t">'+l.time+'</span>'+
            '<span style="color:'+l.color+'">'+l.icon+' ['+l.level+']</span> '+
            l.msg+'</div>').join('');
        document.getElementById('logs').innerHTML=rows;
      }catch(e){}
      document.getElementById('info').textContent='Last refresh: '+new Date().toLocaleTimeString();
    }
    refresh();
    setInterval(refresh,3000);
  </script>
</body>
</html>`);
}).listen(process.env.PORT || 3000, () => {
  addLog('Web Server Started!', 'SUCCESS');
});

// ── Bot State ────────────────────────────
let activeClient = null;

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
      xuid: '',
      platform_chat_id: '',
      message: text,
    });
    addLog(`TG→MC: ${text}`, 'TG');
  } catch (e) {
    addLog(`TG→MC Error: ${e.message}`, 'ERROR');
  }
});

// ── MC Connect ───────────────────────────
function connectBot() {
  addLog('━━━━━━━━━━━ New Session ━━━━━━━━━━━');
  stats.totalAttempts++;

  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  const botName = `Zidan_Bot_${randomNum}`;
  const fakeDeviceId = crypto.randomUUID();
  stats.currentBot = botName;

  addLog(`Connecting as ${botName}...`);

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
    addLog(`Client Error: ${err.message}`, 'ERROR');
    stats.totalErrors++;
    stats.lastError = err.message;
    return setTimeout(connectBot, 20000);
  }

  client.on('connect', () => addLog('RakNet connection initiated...'));

  client.on('spawn', () => {
    addLog(`${botName} joined!`, 'SUCCESS');
    stats.successJoins++;
    stats.isInGame = true;
    stats.lastJoin = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
    activeClient = client;

    tgBot.sendMessage(TG_CHAT_ID,
      `✅ *${botName}* game এ join করেছে!\n🕐 ${stats.lastJoin}`,
      { parse_mode: 'Markdown' }
    );

    // MC → TG
    client.on('text', (packet) => {
      if (!stats.isInGame) return;
      const sender = packet.source_name || '';
      const message = packet.message || '';
      if (sender === botName || !message.trim()) return;

      addLog(`MC→TG: [${sender}] ${message}`, 'MC');
      const formatted = sender ? `💬 *${sender}*: ${message}` : `📢 ${message}`;
      tgBot.sendMessage(TG_CHAT_ID, formatted, { parse_mode: 'Markdown' })
        .catch(() => tgBot.sendMessage(TG_CHAT_ID, `💬 ${sender}: ${message}`));
    });

    // Anti-AFK
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', {
          request_time: BigInt(Date.now()),
          response_time: BigInt(Date.now())
        });
      } catch (e) {}
    }, 15000);
    client._afk = afkInterval;
  });

  const cleanup = () => {
    if (client._afk) clearInterval(client._afk);
    stats.isInGame = false;
    activeClient = null;
    setTimeout(connectBot, 20000);
  };

  client.on('disconnect', (packet) => {
    const msg = packet?.message || 'Unknown';
    addLog(`Disconnected: ${msg}`, 'ERROR');
    stats.totalErrors++;
    stats.lastError = msg;
    tgBot.sendMessage(TG_CHAT_ID, `❌ Bot disconnect: ${msg}`).catch(() => {});
    cleanup();
  });

  client.on('error', (err) => {
    addLog(`Error: ${err.message}`, 'ERROR');
    stats.totalErrors++;
    stats.lastError = err.message;
    try { client.close(); } catch (e) {}
    cleanup();
  });
}

// ── Start ────────────────────────────────
addLog('Zidan Bot starting...', 'INFO');
startTelegramBot();   // TG আগে start
connectBot();         // MC connect
