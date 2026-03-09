const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = 3002;

// Static files
app.use(express.static('public'));

// Current notice state
let currentNotice = {
  imagePath: null,
  expiresAt: null,
  caption: '',
  duration: null
};

// WhatsApp Client - simpler setup
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox']
  }
});

// Simple message handler
client.on('message', async (message) => {
  console.log(`📨 Message from: ${message.from}`);
  console.log(`📝 Body: "${message.body}"`);
  console.log(`🖼️ Has media: ${message.hasMedia}`);
  console.log(`📋 Type: ${message.type}`);
  
  // Accept all messages for testing
  if (message.hasMedia) {
    try {
      console.log('📎 Downloading media...');
      const media = await message.downloadMedia();
      console.log(`✅ Media downloaded: ${media?.mimetype}`);
      
      if (media && media.mimetype.startsWith('image/')) {
        // Save image
        const filename = `notice-${Date.now()}.jpg`;
        const imagePath = path.join(__dirname, 'public', 'notices', filename);
        
        await fs.ensureDir(path.dirname(imagePath));
        await fs.writeFile(imagePath, Buffer.from(media.data, 'base64'));
        
        // Update notice
        currentNotice = {
          imagePath: imagePath,
          expiresAt: Date.now() + (2 * 60 * 60 * 1000), // 2 hours
          caption: message.body,
          duration: { value: 2, unit: 'hours' }
        };
        
        console.log(`🎉 Notice saved: ${filename}`);
        message.reply('✅ Notice updated successfully!');
        
      } else {
        console.log('📄 Not an image file');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      message.reply('❌ Could not process image');
    }
  } else {
    console.log('📄 Text message - no media');
    if (message.body.toLowerCase() === '/status') {
      if (currentNotice.imagePath) {
        message.reply('📊 Notice is active');
      } else {
        message.reply('📊 No active notice');
      }
    }
  }
});

// QR code handler
client.on('qr', (qr) => {
  console.log('🔄 QR Code received');
  console.log('🌐 Scan QR code in WhatsApp Web');
});

// Ready handler
client.on('ready', () => {
  console.log('✅ WhatsApp client ready!');
});

// API endpoints
app.get('/api/kiosk/current-notice', (req, res) => {
  if (currentNotice.imagePath) {
    const filename = path.basename(currentNotice.imagePath);
    res.json({
      success: true,
      noticeUrl: `/notices/${filename}`,
      expiresAt: currentNotice.expiresAt,
      caption: currentNotice.caption
    });
  } else {
    res.json({ success: false, message: 'No active notice' });
  }
});

app.get('/api/kiosk/notice-image', (req, res) => {
  if (currentNotice.imagePath && fs.existsSync(currentNotice.imagePath)) {
    res.sendFile(currentNotice.imagePath);
  } else {
    res.status(404).json({ error: 'No notice image' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  client.initialize();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('👋 Shutting down...');
  await client.destroy();
  process.exit(0);
});
