// ── Advanced Bot Connection ──────────────
let botSessionTimer;

function connectBot() {
  if (!isBotEnabled) return;
  if (currentClient) return; // শুধু currentClient চেক করবে, অন্য কোনো বাধা নেই

  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const randomNum = Math.floor(Math.random() * 9000) + 1000; 
  const botName = `Zidan_Bot_${randomNum}`;
  const fakeDeviceId = crypto.randomUUID(); 

  addLog(`🔌 Connecting as ${botName}...`);

  let client;
  try {
    // আপনার অরিজিনাল লজিক একদম হুবহু
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
    currentClient = client; // টেলিগ্রামের জন্য সেট করা হলো
  } catch (err) {
    addLog(`❌ Client Error: ${err.message}`);
    currentClient = null;
    if (isBotEnabled) setTimeout(connectBot, 20000);
    return;
  }

  client.on('connect', () => addLog('🔗 Initiating RakNet Connection...'));
  
  client.on('spawn', () => {
    addLog('✅ Bot successfully joined the game!');
    
    const afkInterval = setInterval(() => {
      try {
        client.queue('tick_sync', { 
            request_time: BigInt(Date.now()), 
            response_time: BigInt(Date.now()) 
        });
      } catch (e) {}
    }, 15000);

    botSessionTimer = setTimeout(() => {
      addLog(`⏳ ${sessionMinutes} mins session complete. Disconnecting...`);
      clearInterval(afkInterval);
      client.disconnect();
    }, sessionMinutes * 60 * 1000);
    
    client.afkInterval = afkInterval;
  });

  // ── Minecraft Chat to Telegram Forwarder ──
  client.on('text', (packet) => {
    if (packet.type === 'chat' || packet.type === 'translation') {
      const msg = packet.message;
      const source = packet.source_name;
      
      if (source === client.username) return;

      const formatMsg = source ? `[MC] ${source}: ${msg}` : `[MC] ${msg}`;
      if (tgBot) {
        tgBot.sendMessage(adminId, formatMsg).catch(()=>{});
      }
    }
  });

  function handleDisconnect() {
    clearTimeout(botSessionTimer);
    if (client.afkInterval) clearInterval(client.afkInterval);
    if (currentClient === client) currentClient = null;
    
    if (isBotEnabled) {
      setTimeout(connectBot, 20000);
    }
  }

  client.on('disconnect', (packet) => {
    addLog(`❌ Server Disconnected: ${packet.message || 'Unknown'}`);
    handleDisconnect();
  });

  client.on('error', (err) => {
    addLog(`⚠️ Connection Error: ${err.message}`);
    try { client.close(); } catch(e) {}
    handleDisconnect();
  });
}
