const bedrock = require('bedrock-protocol');
const http = require('http');

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot running!');
}).listen(process.env.PORT || 3000);

const HOST = 'fluera.aternos.me';
const PORT = 64885;

function connectBot() {
  console.log(`🔌 Joining ${HOST}:${PORT}...`);

  const client = bedrock.createClient({
    host: HOST,
    port: PORT,
    username: 'AternosBot',
    offline: true,
    version: '1.21.0',
    connectTimeout: 30000,
    skipPing: true  // ← ping skip, সরাসরি join
  });

  client.on('spawn', () => {
    console.log('✅ Bot joined successfully!');
  });

  client.on('disconnect', (packet) => {
    console.log('❌ Disconnected:', packet.message);
    console.log('🔄 Reconnecting in 20s...');
    setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    console.log('⚠️ Error:', err.message);
    console.log('🔄 Retrying in 20s...');
    client.close?.();
    setTimeout(connectBot, 20000);
  });
}

connectBot();
