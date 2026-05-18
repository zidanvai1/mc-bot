const http = require('http');
const path = require('path');
const bedrock = require('bedrock-protocol');

const HOST = 'fluera.aternos.me';
const PORT = 64885;

// ── Web Logger System ────────────────────
let logs = [];

function addLog(msg) {
  const time = new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' });
  const logMessage = `[${time}] ${msg}`;
  
  console.log(logMessage);
  logs.unshift(logMessage); 
  
  if (logs.length > 100) logs.pop();
}

// ── Web Server (Live Dashboard) ──────────
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Zidan Bot - Live Logs</title>
      <meta http-equiv="refresh" content="3">
      <style>
        body { background-color: #0f172a; color: #22d3ee; font-family: 'Courier New', Courier, monospace; padding: 20px; margin: 0; }
        h2 { color: #f8fafc; text-align: center; }
        .log-container { background-color: #020617; padding: 20px; border: 1px solid #334155; border-radius: 8px; height: 75vh; overflow-y: auto; line-height: 1.5; }
        .time { color: #94a3b8; }
      </style>
    </head>
    <body>
      <h2>🤖 Zidan Bot - Aternos Status</h2>
      <div class="log-container">
        ${logs.map(log => log.replace(/\[(.*?)\]/, '<span class="time">[$1]</span>')).join('<br>')}
      </div>
    </body>
    </html>
  `;
  res.end(html);
}).listen(process.env.PORT || 3000, () => {
  addLog('🌐 HTTP Dashboard Server Started! Open browser to see logs.');
});

// ── Ping Bypass (Direct Join Hack) ───────
const bedrockPath = path.dirname(require.resolve('bedrock-protocol'));
const rak = require(bedrockPath + '/src/rak');

const _originalPing = rak.ping;
rak.ping = async function(options) {
  try {
    return await Promise.race([
      _originalPing(options),
      new Promise(resolve =>
        setTimeout(() => {
          addLog('⚡ Ping timeout detected, bypassing directly to server...');
          resolve({
            version: '1.21.0',
            protocolVersion: 748,
            name: 'Aternos',
            playersOnline: 0,
            playersMax: 20
          });
        }, 3000)
      )
    ]);
  } catch (e) {
    addLog('⚡ Ping failed, forcing direct bypass...');
    return {
      version: '1.21.0',
      protocolVersion: 748,
      name: 'Aternos',
      playersOnline: 0,
      playersMax: 20
    };
  }
};

// ── Bot Connection System ────────────────
let botSessionTimer;

function connectBot() {
  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Name generator: Zidan_Bot_1000 to Zidan_Bot_9999
  const randomNum = Math.floor(Math.random() * 9000) + 1000; 
  const botName = `Zidan_Bot_${randomNum}`;

  addLog(`🔌 Connecting as ${botName}...`);

  let client;
  try {
    client = bedrock.createClient({
      host: HOST,
      port: PORT,
      username: botName,
      offline: true,
      version: '1.21.0',
      connectTimeout: 30000
    });
  } catch (err) {
    addLog(`❌ Client Error: ${err.message}`);
    addLog('🔄 Retrying in 20 seconds...');
    return setTimeout(connectBot, 20000);
  }

  client.on('connect', () => addLog('🔗 Successfully bridged to server network!'));
  client.on('login', () => addLog('🔑 Login packet processed.'));
  
  client.on('spawn', () => {
    addLog('✅ Bot is now ALIVE and in the game!');
    
    // 30 mins session
    const thirtyMinutes = 30 * 60 * 1000;
    botSessionTimer = setTimeout(() => {
      addLog('⏳ 30 minutes over. Leaving game to cycle bot...');
      client.disconnect();
    }, thirtyMinutes);
  });

  client.on('disconnect', (packet) => {
    addLog(`❌ Kicked/Disconnected: ${packet.message || 'Unknown reason'}`);
    clearTimeout(botSessionTimer); 
    addLog('🔄 Bringing a new bot in 20 seconds...');
    setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    addLog(`⚠️ Connection Error: ${err.message}`);
    try { client.close(); } catch(e) {}
    clearTimeout(botSessionTimer);
    addLog('🔄 Bringing a new bot in 20 seconds...');
    setTimeout(connectBot, 20000);
  });
}

connectBot();
