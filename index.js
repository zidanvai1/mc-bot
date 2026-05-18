const bedrock = require('bedrock-protocol');
const http = require('http');

// Render free tier বন্ধ না হওয়ার জন্য
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
});
server.listen(process.env.PORT || 3000, () => {
  console.log('🌐 Web server alive');
});

const HOST = 'fluera.aternos.me';
const PORT = 64885;

function connectBot() {
  console.log(`🔌 Connecting to ${HOST}:${PORT}...`);

  const client = bedrock.createClient({
    host: HOST,
    port: PORT,
    username: 'AternosBot',
    offline: true,
    version: '1.21.0'
  });

  client.on('spawn', () => {
    console.log('✅ Bot joined! Server is ONLINE');
  });

  client.on('text', (packet) => {
    console.log('💬 Chat:', packet.message);
  });

  client.on('disconnect', (packet) => {
    console.log('❌ Disconnected:', packet.message || 'Unknown');
    console.log('🔄 Reconnecting in 15 seconds...');
    setTimeout(connectBot, 15000);
  });

  client.on('error', (err) => {
    console.log('⚠️ Error:', err.message);
    setTimeout(connectBot, 15000);
  });
}

connectBot();
