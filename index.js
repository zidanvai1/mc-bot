require('dotenv').config(); // .env ফাইল থেকে BOT_TOKEN লোড করার জন্য
const http = require('http');
const bedrock = require('bedrock-protocol');
const crypto = require('crypto'); // Random Device ID তৈরির জন্য
const TelegramBot = require('node-telegram-bot-api');

const HOST = 'fluera.aternos.me';
const PORT = 64885;
const TG_CHAT_ID = 7675471513; // আপনার Telegram ID

// Telegram Bot Setup
const tgBot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

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

// ── Global Variables for Chat ────────────
let isBotInGame = false;
let currentClient = null;

// ── Advanced Bot Connection ──────────────
function connectBot() {
  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const randomNum = Math.floor(Math.random() * 9000) + 1000; 
  const botName = `Zidan_Bot_${randomNum}`;
  
  // Fake Android Device UUID generate করা হচ্ছে
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
      skipPing: true,        // Ping একেবারে skip করবে (Direct Join)
      deviceOS: 1,           // 1 = Android, 7 = Windows (Spoofing as mobile)
      deviceId: fakeDeviceId, 
      connectTimeout: 30000
    });
    currentClient = client; // আপডেট করা ক্লায়েন্ট গ্লোবাল ভ্যারিয়েবলে রাখা হলো
  } catch (err) {
    addLog(`❌ Client Error: ${err.message}`);
    return setTimeout(connectBot, 20000);
  }

  client.on('connect', () => addLog('🔗 Initiating RakNet Connection...'));
  
  client.on('spawn', () => {
    isBotInGame = true; // বট গেমে ঢুকেছে
    addLog('✅ Bot successfully joined the game!');
    tgBot.sendMessage(TG_CHAT_ID, '✅ Bot successfully joined the Minecraft server!').catch(()=>{});
    
    // Anti-AFK Tick Sync (Keep-alive packet)
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', { 
            request_time: BigInt(Date.now()), 
            response_time: BigInt(Date.now()) 
        });
      } catch (e) {}
    }, 15000);

    // 30 মিনিটের টাইমার রিমুভ করা হয়েছে। বট এখন নিজে থেকে ডিসকানেক্ট হবে না।
    client.afkInterval = afkInterval;
  });

  // Minecraft থেকে মেসেজ আসলে Telegram এ পাঠানো (শুধুমাত্র গেমে থাকলে)
  client.on('text', (packet) => {
    if (isBotInGame && packet.message) {
      let chatMsg = packet.source_name ? `${packet.source_name}: ${packet.message}` : packet.message;
      
      // চ্যাট মেসেজটি আপনার আইডিতে পাঠানো হচ্ছে
      tgBot.sendMessage(TG_CHAT_ID, `💬 ${chatMsg}`).catch(()=>{});
    }
  });

  client.on('disconnect', (packet) => {
    isBotInGame = false; // গেম থেকে বের হয়ে গেছে
    addLog(`❌ Server Disconnected: ${packet.message || 'Unknown'}`);
    tgBot.sendMessage(TG_CHAT_ID, `❌ Server Disconnected: ${packet.message || 'Unknown'}`).catch(()=>{});
    
    if(client.afkInterval) clearInterval(client.afkInterval);
    setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    isBotInGame = false;
    addLog(`⚠️ Connection Error: ${err.message}`);
    try { client.close(); } catch(e) {}
    
    if(client.afkInterval) clearInterval(client.afkInterval);
    setTimeout(connectBot, 20000);
  });
}

// ── Telegram থেকে Minecraft এ মেসেজ পাঠানো ──
tgBot.on('message', (msg) => {
  // মেসেজটি কি আপনার নির্দিষ্ট ID থেকে এসেছে এবং বট কি গেমে আছে কিনা তা চেক করা হচ্ছে
  if (msg.chat.id === TG_CHAT_ID && isBotInGame && currentClient) {
    if (msg.text) {
      try {
        currentClient.queue('text', {
          type: 'chat',
          needs_translation: false,
          source_name: currentClient.username,
          xuid: '',
          platform_chat_id: '',
          message: msg.text
        });
        addLog(`📤 Sent to MC: ${msg.text}`);
      } catch (err) {
        addLog(`❌ Failed to send msg to MC: ${err.message}`);
      }
    }
  } else if (msg.chat.id === TG_CHAT_ID && !isBotInGame) {
      tgBot.sendMessage(TG_CHAT_ID, '⚠️ Bot is not currently in the game. Please wait.').catch(()=>{});
  }
});

connectBot();
