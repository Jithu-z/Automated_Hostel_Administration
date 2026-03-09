const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');

const app = express();
const PORT = 3001;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Static files
app.use(express.static('public'));

// Ensure directories exist
const NOTICE_DIR = path.join(__dirname, 'public', 'notices');
const QRCODE_DIR = path.join(__dirname, 'public', 'qrcodes');

fs.ensureDirSync(NOTICE_DIR);
fs.ensureDirSync(QRCODE_DIR);

// File storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, NOTICE_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}-${Date.now()}.jpg`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// WhatsApp Client Setup
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'hostel-bot-session'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  },
  qrMaxRetries: 3,
  takeoverOnConflict: false,
  takeoverTimeoutMs: 10000
});

// Current notice state
let currentNotice = {
  imagePath: null,
  expiresAt: null,
  caption: '',
  duration: null
};

// Parse time from caption
function parseTimeFromCaption(caption) {
  console.log(`Parsing time from caption: "${caption}"`);
  
  const patterns = [
    { regex: /#(\d+)d/, multiplier: 24 * 60 * 60 * 1000, unit: 'days' },
    { regex: /#(\d+)h/, multiplier: 60 * 60 * 1000, unit: 'hours' },
    { regex: /#(\d+)hr/, multiplier: 60 * 60 * 1000, unit: 'hours' },
    { regex: /#(\d+)m/, multiplier: 60 * 1000, unit: 'minutes' },
    { regex: /#(\d+)min/, multiplier: 60 * 1000, unit: 'minutes' },
    { regex: /#(\d+)s/, multiplier: 1000, unit: 'seconds' },
    { regex: /#(\d+)sec/, multiplier: 1000, unit: 'seconds' }
  ];

  for (const pattern of patterns) {
    const match = caption.match(pattern.regex);
    console.log(`Testing pattern ${pattern.regex}: match = ${JSON.stringify(match)}`);
    if (match && match[1]) {
      const value = parseInt(match[1]);
      console.log(`Found match: ${value} ${pattern.unit}`);
      return {
        duration: value * pattern.multiplier,
        unit: pattern.unit,
        value: value
      };
    }
  }
  console.log(`No time pattern found, using default`);
  return { duration: 24 * 60 * 60 * 1000, unit: 'days', value: 1 }; // Default: 1 day
}

// Process image message function
async function processImageMessage(message, media) {
  try {
    console.log('Processing image message...');
    
    // Save image
    const buffer = Buffer.from(media.data, 'base64');
    const filename = `${uuidv4()}-${Date.now()}.jpg`;
    const imagePath = path.join(NOTICE_DIR, filename);
    
    fs.writeFileSync(imagePath, buffer);
    console.log(`Image saved: ${filename}`);
    
    // Process and optimize image
    const processedPath = await processImage(message, imagePath);
    
    // Parse time from caption
    const timeInfo = parseTimeFromCaption(message.body);
    const expiresAt = Date.now() + timeInfo.duration;
    
    // Clean previous notice
    if (currentNotice.imagePath && fs.existsSync(currentNotice.imagePath)) {
      fs.removeSync(currentNotice.imagePath);
    }
    
    // Update current notice
    currentNotice = {
      imagePath: processedPath,
      expiresAt: expiresAt,
      caption: message.body,
      duration: timeInfo
    };
    
    // Send confirmation
    const reply = `Notice updated successfully!\n\nDuration: ${timeInfo.value} ${timeInfo.unit}\nExpires: ${new Date(expiresAt).toLocaleString()}\n\nYour notice is now displayed on the kiosk.`;
    message.reply(reply);
    
    console.log(`Notice updated: ${processedPath}, expires in ${timeInfo.value} ${timeInfo.unit}`);
    
  } catch (error) {
    console.error('Error processing image message:', error);
    message.reply('Sorry, there was an error processing your image. Please try again.');
  }
}

// Clean expired notices
function cleanExpiredNotices() {
  if (currentNotice.expiresAt && Date.now() > currentNotice.expiresAt) {
    if (currentNotice.imagePath && fs.existsSync(currentNotice.imagePath)) {
      fs.removeSync(currentNotice.imagePath);
    }
    currentNotice = {
      imagePath: null,
      expiresAt: null,
      caption: '',
      duration: null
    };
    console.log('Expired notice cleaned up');
  }
}

// Process received image
async function processImage(message, imagePath) {
  try {
    // Optimize image for kiosk display
    const optimizedPath = imagePath.replace('.jpg', '-optimized.jpg');
    await sharp(imagePath)
      .resize(1920, 1080, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .toFile(optimizedPath);

    // Remove original
    fs.removeSync(imagePath);
    
    return optimizedPath;
  } catch (error) {
    console.error('Error processing image:', error);
    return imagePath; // Return original if processing fails
  }
}

// WhatsApp event handlers
client.on('qr', async (qr) => {
  console.log('QR Code received (attempt ' + (client.info ? 'retry' : 'first') + ')');
  console.log('Open http://localhost:3001/qr.png to scan');
  console.log('QR expires in 20 seconds - scan quickly!');
  
  // Generate QR code and save as image
  try {
    const qrImagePath = path.join(__dirname, 'public', 'qr.png');
    await qrcode.toFile(qrImagePath, qr, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('QR code ready at: http://localhost:3001/qr.png');
    
    // Auto-refresh QR after 20 seconds
    setTimeout(() => {
      console.log('QR code expired, generating new one...');
    }, 20000);
    
  } catch (error) {
    console.error('Error generating QR code:', error);
  }
});

client.on('loading_screen', (percent, message) => {
  console.log(`Loading WhatsApp: ${percent}% - ${message}`);
});

client.on('auth_failure', msg => {
  console.error('Authentication failed:', msg);
  console.log('Try deleting .wwebjs_auth folder and restart');
});

client.on('disconnected', reason => {
  console.log('WhatsApp disconnected:', reason);
  console.log('Restarting bot...');
  setTimeout(() => {
    client.initialize();
  }, 5000);
});

client.on('ready', () => {
  console.log('WhatsApp client is ready!');
  console.log('Bot is now active and listening for messages...');
});

// Handle message acknowledgments (for encrypted messages)
client.on('message_ack', (msg, ack) => {
  console.log(`Message ACK: ${ack.type} for message ${msg.id._serialized}`);
});

// Whitelisted recipient - only process messages sent to this group
const WHITELISTED_RECIPIENT = '146136966922311@lid'; // Your specific group ID

// Handle message creation events - PROCESS MESSAGES SENT FROM LINKED DEVICES
client.on('message_create', async (message) => {
  console.log(`Message created: "${message.body}" fromMe: ${message.fromMe} to: ${message.to}`);
  
  // ONLY process messages sent FROM the bot's account (from linked devices)
  if (!message.fromMe) {
    console.log('Ignoring message sent TO bot (not FROM linked device)');
    return;
  }
  
  // ONLY process messages sent to the whitelisted recipient
  if (message.to !== WHITELISTED_RECIPIENT) {
    console.log(`Ignoring message sent to ${message.to} (not whitelisted)`);
    return;
  }
  
  console.log(`Processing message sent to whitelisted recipient: ${WHITELISTED_RECIPIENT}`);
  
  if (message.hasMedia) {
    try {
      console.log('Downloading media...');
      const media = await message.downloadMedia();
      console.log(`Media downloaded: ${media?.mimetype}`);
      
      if (media && media.mimetype.startsWith('image/')) {
        console.log('Image detected, processing...');
        await processImageMessage(message, media);
      }
    } catch (error) {
      console.error('Error downloading media:', error);
    }
  } else {
    console.log('Text message');
    // Handle text commands
    const body = message.body.toLowerCase();
    if (body === '/status') {
      if (currentNotice.imagePath) {
        const timeLeft = Math.max(0, currentNotice.expiresAt - Date.now());
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        const reply = `Current Notice Status:\n\nActive: Yes\nTime remaining: ${hoursLeft}h ${minutesLeft}m\nCaption: ${currentNotice.caption}\n\nExpires: ${new Date(currentNotice.expiresAt).toLocaleString()}`;
        message.reply(reply);
      } else {
        message.reply('No active notice currently displayed.');
      }
    } else if (body === '/clear') {
      if (currentNotice.imagePath && fs.existsSync(currentNotice.imagePath)) {
        fs.removeSync(currentNotice.imagePath);
      }
      currentNotice = {
        imagePath: null,
        expiresAt: null,
        caption: '',
        duration: null
      };
      message.reply('Notice cleared from kiosk display.');
      console.log('Notice cleared by command');
    } else if (body === '/help') {
      const helpText = `Hostel Notice Bot Help:\n\nSend an image with caption:\n   • #1d - Display for 1 day\n   • #2h - Display for 2 hours\n   • #30m - Display for 30 minutes\n   • #60s - Display for 60 seconds\n\nCommands:\n   • /status - Check current notice\n   • /clear - Remove current notice\n   • /help - Show this help`;
      message.reply(helpText);
    }
  }
});

// Also try message_sent event for linked device messages
client.on('message_sent', async (message) => {
  console.log(`Message sent: "${message.body}" to ${message.to}`);
  
  if (message.hasMedia) {
    try {
      const media = await message.downloadMedia();
      if (media && media.mimetype.startsWith('image/')) {
        console.log('Image from message_sent, processing...');
        await processImageMessage(message, media);
      }
    } catch (error) {
      console.error('Error with message_sent:', error);
    }
  }
});

client.on('message', async (message) => {
  // Ignore incoming messages - only process messages sent FROM linked devices
  console.log(`Ignoring incoming message from: ${message.from}`);
});

// API Endpoints for kiosk
app.get('/api/kiosk/current-notice', (req, res) => {
  cleanExpiredNotices();
  
  if (currentNotice.imagePath) {
    const filename = path.basename(currentNotice.imagePath);
    res.json({
      success: true,
      noticeUrl: `/notices/${filename}`,
      expiresAt: currentNotice.expiresAt,
      caption: currentNotice.caption,
      duration: currentNotice.duration
    });
  } else {
    res.json({
      success: false,
      message: 'No active notice'
    });
  }
});

app.get('/api/kiosk/notice-image', (req, res) => {
  cleanExpiredNotices();
  
  if (currentNotice.imagePath && fs.existsSync(currentNotice.imagePath)) {
    res.sendFile(currentNotice.imagePath);
  } else {
    res.status(404).json({ error: 'No notice image found' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    whatsappReady: client.info ? true : false
  });
});

// Cleanup expired notices every minute
setInterval(cleanExpiredNotices, 60000);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://10.189.170.171:${PORT}`);
  
  // Start WhatsApp client with retry logic
  const initializeWithRetry = async (retries = 3) => {
    try {
      console.log('Initializing WhatsApp client...');
      await client.initialize();
    } catch (error) {
      console.error(`Failed to initialize:`, error.message);
    }
  };
  
  initializeWithRetry();
});

// Shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await client.destroy();
  process.exit(0);
});
