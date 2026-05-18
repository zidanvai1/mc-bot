const http = require('http');

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot running!');
}).listen(process.env.PORT || 3000, () => {
  console.log('🌐 HTTP server started');
});

// ── Ping Bypass ──────────────────────────
const path = require('path');
const bedrockPath = path.dirname(require.resolve('bedrock-protocol'));
const rak = require(bedrockPath + '/src/rak');

const _originalPing = rak.ping;
rak.ping = async function(options) {
  try {
    return await Promise.race([
      _originalPing(options),
      new Promise(resolve =>
        setTimeout(() => {
          console.log('⚡ Ping blocked, bypassing...');
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
    console.log('⚡ Ping failed, bypassing...');
    return {
      version: '1.21.0',
      protocolVersion: 748,
      name: 'Aternos',
      playersOnline: 0,
      playersMax: 20
    };
  }
};
// ─────────────────────────────────────────

const bedrock = require('bedrock-protocol');
const HOST = 'fluera.aternos.me';
const PORT = 64885;

function connectBot() {
  console.log('━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔌 Joining ${HOST}:${PORT}`);

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
    console.log('❌ createClient error:', err.message);
    return setTimeout(connectBot, 20000);
  }

  client.on('connect', () => console.log('🔗 Connected!'));
  client.on('login', () => console.log('🔑 Login packet!'));
  client.on('spawn', () => console.log('✅ Bot spawned!'));

  client.on('disconnect', (packet) => {
    console.log('❌ Disconnected:', packet.message);
    setTimeout(connectBot, 20000);
  });

  client.on('error', (err) => {
    console.log('⚠️ Error:', err.message);
    try { client.close(); } catch(e) {}
    setTimeout(connectBot, 20000);
  });
}

connectBot();
