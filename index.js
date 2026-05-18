const bedrock = require('bedrock-protocol');
const http = require('http');

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot running!');
}).listen(process.env.PORT || 3000, () => {
  console.log('🌐 HTTP server started');
});

const HOST = 'fluera.aternos.me';
const PORT = 64885;

function connectBot() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔌 Trying to join ${HOST}:${PORT}`);
  console.log(`🕐 Time: ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');

  let client;

  try {
    client = bedrock.createClient({
      host: HOST,
      port: PORT,
      username: 'AternosBot',
      offline: true,
      version: '1.21.0',
      connectTimeout: 30000
    });
  } catch (err) {
    console.log('❌ createClient failed:', err.message);
    return setTimeout(connectBot, 20000);
  }

  console.log('📡 Client created, waiting for response...');

  client.on('connect', () => {
    console.log('🔗 TCP/UDP Connected!');
  });

  client.on('login', () => {
    console.log('🔑 Login packet received!');
  });

  client.on('spawn', () => {
    console.log('✅ BOT SPAWNED! Server is alive!');
  });

  client.on('join', () => {
    console.log('🎮 Bot joined the world!');
  });

  // সব packet log করো
  client.on('packet', (packet) => {
    console.log('📦 Packet:', packet?.data?.name || 'unknown');
  });

  client.on('disconnect', (packet) => {
    console.log('❌ DISCONNECTED!');
    console.log('📄 Reason:', JSON.stringify(packet));
    setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    console.log('🚨 ERROR:', err.message);
    console.log('📋 Stack:', err.stack);
    try { client.close(); } catch(e) {}
    setTimeout(connectBot, 20000);
  });

  client.on('close', () => {
    console.log('🔒 Connection closed');
  });

  // 35 সেকেন্ডে কিছু না হলে force retry
  setTimeout(() => {
    if (!client) return;
    console.log('⏰ Timeout! Force closing and retrying...');
    try { client.close(); } catch(e) {}
  }, 35000);
}

connectBot();
