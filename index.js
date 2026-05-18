const bedrock = require('bedrock-protocol');
const express = require('express');

// Render-এর জন্য ওয়েব সার্ভার
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Minecraft Bedrock Bot is aggressively trying to join!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// যেকোনো ক্র্যাশ বা এরর বাইপাস করার জন্য (বট বন্ধ হবে না)
process.on('uncaughtException', (err) => {
    console.log(`[Warning] ${err.message} - Skipping and retrying...`);
});
process.on('unhandledRejection', (err) => {
    console.log(`[Warning] ${err.message} - Skipping and retrying...`);
});

// মূল বট ফাংশন
function startBot() {
    console.log('সার্ভারে জোর করে ঢোকার চেষ্টা চলছে...');
    
    try {
        const client = bedrock.createClient({
            host: 'fluera.aternos.me',   
            port: 64885,                 
            username: 'AternosBot',      
            version: '1.21.0',           
            offline: true,               
            skipPing: true,              // কোনো পিং চেক করবে না
            connectTimeout: 10000        // ১০ সেকেন্ডে ঢুকতে না পারলে আবার ট্রাই করবে
        });

        client.on('join', () => {
            console.log(`\n========================================`);
            console.log(`[Success] ${client.options.username} অবশেষে সার্ভারে ঢুকেছে!`);
            console.log(`========================================\n`);
        });

        client.on('text', (packet) => {
            if (packet.source_name !== client.options.username) {
                console.log(`[Chat] ${packet.source_name}: ${packet.message}`);
            }
        });

        // ডিসকানেক্ট হলে আবার সাথে সাথে ট্রাই করবে
        client.on('disconnect', (packet) => {
            console.log(`[Disconnected] কারণ: ${packet.reason}। আবার ট্রাই করা হচ্ছে...`);
            setTimeout(startBot, 2000); // ২ সেকেন্ড পর আবার ধাক্কা দিবে
        });

        // টাইমআউট বা অন্য এরর আসলে না থেমে আবার ট্রাই করবে
        client.on('error', (err) => {
            console.log(`[Error] ঢুকতে ব্যর্থ (${err.message})। থামছি না, আবার চেষ্টা চলছে...`);
            client.close(); // আগের কানেকশন কেটে ফ্রেশ ট্রাই
            setTimeout(startBot, 2000);
        });

    } catch (e) {
        setTimeout(startBot, 2000);
    }
}

// বট চালু করা
startBot();
