const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto'); // Random Device ID toiri korar jonno

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

// ── Web Server Dashboard ─────────────────
http.createServer((req, res) => {
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
      </style>
    </head>
    <body>
      <h2>🤖 Zidan Bot (Advanced Evasion) - Status</h2>
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
  } catch (err) {
    addLog(`❌ Client Error: ${err.message}`);
    return setTimeout(connectBot, 20000);
  }

  client.on('connect', () => addLog('🔗 Initiating RakNet Connection...'));
  
  client.on('spawn', () => {
    addLog('✅ Bot successfully joined the game!');
    
    // Anti-AFK Tick Sync (Keep-alive packet)
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', { 
            request_time: BigInt(Date.now()), 
            response_time: BigInt(Date.now()) 
        });
      } catch (e) {}
    }, 15000);

    // 30 minute er timer
    botSessionTimer = setTimeout(() => {
      addLog('⏳ 30 mins session complete. Disconnecting to cycle bot...');
      clearInterval(afkInterval);
      client.disconnect();
    }, 30 * 60 * 1000);
    
    client.afkInterval = afkInterval;
  });

  client.on('disconnect', (packet) => {
    addLog(`❌ Server Disconnected: ${packet.message || 'Unknown'}`);
    clearTimeout(botSessionTimer);
    if(client.afkInterval) clearInterval(client.afkInterval);
    setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    addLog(`⚠️ Connection Error: ${err.message}`);
    try { client.close(); } catch(e) {}
    clearTimeout(botSessionTimer);
    if(client.afkInterval) clearInterval(client.afkInterval);
    setTimeout(connectBot, 20000);
  });
}

connectBot();
